// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    IOutcomeToken6909,
    IBinaryMarketsModule,
    IBinaryMarket,
    IBinaryPool,
    IERC20Like
} from "./interfaces/IDreamDEX.sol";

/// @title CommonGroundCampaign
/// @notice One non-upgradeable campaign per plan. Holds three buckets of DreamDEX
///         result shares, merges matched Up/Down into a deterministic base budget,
///         and runs one base task plus one conditional bonus task. No admin, no
///         upgrade, no arbitrary call.
contract CommonGroundCampaign {
    // ------------------------------------------------------------------ types
    enum Bucket {
        BaseUp,
        BaseDown,
        Bonus
    }

    enum PlanState {
        Open,
        BaseActive,
        Finished,
        FundingFailed,
        Refundable
    }

    enum TaskState {
        Waiting,
        Ready,
        Running,
        Submitted,
        Accepted,
        Rejected,
        Expired,
        Skipped
    }

    struct Position {
        uint256 baseUp;
        uint256 baseDown;
        uint256 bonus;
    }

    struct Task {
        TaskState state;
        bytes32 evidenceHash;
        string evidenceUri;
        bytes32 reasonHash;
        uint256 startDeadline;
        uint256 decisionDeadline;
        uint256 budget;
    }

    // ------------------------------------------------------- immutable manifest
    address public immutable module;
    address public immutable pool;
    address public immutable market;
    address public immutable outcomeToken;
    address public immutable collateralToken;
    uint256 public immutable baseUpTokenId; // yesId
    uint256 public immutable baseDownTokenId; // noId
    uint256 public immutable bonusTokenId; // the bonus side's outcome id
    uint8 public immutable bonusOutcomeIdx; // 0 = Up, 1 = Down
    uint32 public immutable operatorId;
    bytes32 public immutable venueId;
    bytes32 public immutable marketId;
    address public immutable executor;
    address public immutable verifier;
    address public immutable executorPayee;
    uint256 public immutable maxContributors;

    // ------------------------------------------------------------------ state
    PlanState public planState = PlanState.Open;

    uint256 public totalBaseUp;
    uint256 public totalBaseDown;
    uint256 public totalBonus;
    uint256 public contributorCount;
    mapping(address => Position) public positions;
    mapping(address => bool) public isContributor;

    uint256 public mergedAmount; // matched shares merged into the base budget
    uint256 public baseBudget; // deterministic collateral for the base task
    uint256 public bonusBudget; // collateral for the conditional bonus task
    uint256 public refundBase; // collateral owed to matched base-share holders
    uint256 public refundBonus; // collateral owed to bonus-share holders

    Task public baseTask;
    Task public bonusTask;

    bool private _locked;

    // ------------------------------------------------------------------ events
    event Contributed(address indexed account, Bucket indexed bucket, uint256 amount);
    event Withdrawn(address indexed account, Bucket indexed bucket, uint256 amount);
    event BaseActivated(uint256 matchedAmount, uint256 budget);
    event FundingFailed();
    event BonusSettled(bool won, uint256 budget);
    event TaskStarted(uint256 indexed index);
    event EvidenceSubmitted(uint256 indexed index, bytes32 evidenceHash);
    event Decision(uint256 indexed index, bool accepted, bytes32 reasonHash);
    event Paid(uint256 indexed index, address indexed payee, uint256 amount);
    event Refunded(address indexed account, uint256 amount);

    // -------------------------------------------------------------- constructor
    constructor(
        address module_,
        address pool_,
        address market_,
        address outcomeToken_,
        address collateralToken_,
        uint256 baseUpTokenId_,
        uint256 baseDownTokenId_,
        uint8 bonusOutcomeIdx_,
        uint32 operatorId_,
        bytes32 venueId_,
        bytes32 marketId_,
        address executor_,
        address verifier_,
        address executorPayee_,
        uint256 maxContributors_
    ) {
        require(module_ != address(0) && market_ != address(0), "zero address");
        require(outcomeToken_ != address(0) && collateralToken_ != address(0), "zero address");
        require(executor_ != address(0) && verifier_ != address(0), "zero role");
        require(executorPayee_ != address(0), "zero payee");
        require(bonusOutcomeIdx_ <= 1, "bad outcome idx");

        module = module_;
        pool = pool_;
        market = market_;
        outcomeToken = outcomeToken_;
        collateralToken = collateralToken_;
        baseUpTokenId = baseUpTokenId_;
        baseDownTokenId = baseDownTokenId_;
        bonusOutcomeIdx = bonusOutcomeIdx_;
        bonusTokenId = bonusOutcomeIdx_ == 0 ? baseUpTokenId_ : baseDownTokenId_;
        operatorId = operatorId_;
        venueId = venueId_;
        marketId = marketId_;
        executor = executor_;
        verifier = verifier_;
        executorPayee = executorPayee_;
        maxContributors = maxContributors_;
    }

    // -------------------------------------------------------------- modifiers
    modifier nonReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    modifier onlyExecutor() {
        require(msg.sender == executor, "not executor");
        _;
    }

    modifier onlyVerifier() {
        require(msg.sender == verifier, "not verifier");
        _;
    }

    // ----------------------------------------------------- deposit / withdraw
    function _tokenIdFor(Bucket bucket) internal view returns (uint256) {
        if (bucket == Bucket.BaseUp) return baseUpTokenId;
        if (bucket == Bucket.BaseDown) return baseDownTokenId;
        return bonusTokenId;
    }

    function _register(address account) internal {
        if (!isContributor[account]) {
            isContributor[account] = true;
            contributorCount += 1;
            require(contributorCount <= maxContributors, "contributor cap");
        }
    }

    function deposit(Bucket bucket, uint256 amount) external nonReentrant {
        require(planState == PlanState.Open, "not open");
        require(amount > 0, "zero amount");

        uint256 tokenId = _tokenIdFor(bucket);
        // Contributor must setOperator(campaign, true) on the ERC-6909 singleton first.
        require(
            IOutcomeToken6909(outcomeToken).transferFrom(msg.sender, address(this), tokenId, amount),
            "transfer failed"
        );

        _register(msg.sender);
        Position storage p = positions[msg.sender];
        if (bucket == Bucket.BaseUp) {
            p.baseUp += amount;
            totalBaseUp += amount;
        } else if (bucket == Bucket.BaseDown) {
            p.baseDown += amount;
            totalBaseDown += amount;
        } else {
            p.bonus += amount;
            totalBonus += amount;
        }

        emit Contributed(msg.sender, bucket, amount);
    }

    /// @notice Return own shares before the base budget is locked.
    function withdraw(Bucket bucket, uint256 amount) external nonReentrant {
        require(planState == PlanState.Open, "not open");
        require(amount > 0, "zero amount");

        Position storage p = positions[msg.sender];
        if (bucket == Bucket.BaseUp) {
            require(p.baseUp >= amount, "insufficient");
            p.baseUp -= amount;
            totalBaseUp -= amount;
        } else if (bucket == Bucket.BaseDown) {
            require(p.baseDown >= amount, "insufficient");
            p.baseDown -= amount;
            totalBaseDown -= amount;
        } else {
            require(p.bonus >= amount, "insufficient");
            p.bonus -= amount;
            totalBonus -= amount;
        }

        require(
            IOutcomeToken6909(outcomeToken).transfer(msg.sender, _tokenIdFor(bucket), amount),
            "transfer failed"
        );
        emit Withdrawn(msg.sender, bucket, amount);
    }

    // ---------------------------------------------------- activation / funding
    /// @notice Merge matched Up/Down into deterministic collateral and lock the base budget.
    function activateBase() external nonReentrant {
        require(planState == PlanState.Open, "not open");
        uint256 matched = totalBaseUp < totalBaseDown ? totalBaseUp : totalBaseDown;
        require(matched > 0, "no matched pair");
        require(_marketTrading(), "not trading");

        // Burn matched YES + matched NO held by this contract, credit collateral to it.
        // The pool pulls from this contract via an ERC-6909 operator grant.
        IOutcomeToken6909(outcomeToken).setOperator(pool, true);
        IBinaryPool(pool).burnSet(matched);

        mergedAmount = matched;
        baseBudget = matched;
        baseTask.budget = matched;
        baseTask.state = TaskState.Ready;
        planState = PlanState.BaseActive;

        emit BaseActivated(matched, baseBudget);
    }

    /// @notice Stop an un-activated, expired plan and open original-share exit.
    function failFunding() external nonReentrant {
        require(planState == PlanState.Open, "not open");
        require(_marketSettledOrExpired(), "not expired");
        planState = PlanState.FundingFailed;
        emit FundingFailed();
    }

    // ----------------------------------------------------------- bonus settle
    /// @notice Permissionless: observe on-chain settlement and redeem the bonus side if it won.
    function syncMarketAndBonus() external nonReentrant {
        require(planState == PlanState.BaseActive, "not active");
        require(_marketSettled(), "not settled");

        if (IBinaryMarket(market).isVoided()) {
            // Uniform void: redeem the bonus side at half and put it in the refund pool.
            IOutcomeToken6909(outcomeToken).setOperator(module, true);
            IBinaryMarketsModule(module).redeem(operatorId, venueId, marketId, bonusOutcomeIdx, totalBonus);
            refundBonus += totalBonus / 2;
            bonusBudget = 0;
            bonusTask.state = TaskState.Skipped;
            planState = PlanState.Finished;
            emit BonusSettled(false, 0);
            return;
        }

        uint256[] memory numerators = IBinaryMarket(market).payoutNumerators();
        require(numerators.length == 2, "bad payout vector");
        uint8 winner = numerators[0] > 0 ? 0 : 1;

        if (winner == bonusOutcomeIdx) {
            IOutcomeToken6909(outcomeToken).setOperator(module, true);
            IBinaryMarketsModule(module).redeem(operatorId, venueId, marketId, bonusOutcomeIdx, totalBonus);
            bonusBudget = totalBonus;
            bonusTask.budget = totalBonus;
            bonusTask.state = TaskState.Ready;
            emit BonusSettled(true, bonusBudget);
        } else {
            bonusBudget = 0;
            bonusTask.state = TaskState.Skipped;
            emit BonusSettled(false, 0);
        }
    }

    // ------------------------------------------------------------ task lifecycle
    function _taskFor(uint256 index) internal view returns (Task storage) {
        if (index == 0) return baseTask;
        if (index == 1) return bonusTask;
        revert("bad task index");
    }

    function startTask(uint256 index, uint256 startDeadline, uint256 decisionDeadline)
        external
        onlyExecutor
        nonReentrant
    {
        Task storage t = _taskFor(index);
        require(t.state == TaskState.Ready, "not ready");
        require(startDeadline >= block.timestamp, "start deadline past");
        require(decisionDeadline > startDeadline, "bad deadline");
        t.state = TaskState.Running;
        t.startDeadline = startDeadline;
        t.decisionDeadline = decisionDeadline;
        emit TaskStarted(index);
    }

    function submitEvidence(uint256 index, bytes32 evidenceHash, string calldata evidenceUri)
        external
        onlyExecutor
        nonReentrant
    {
        Task storage t = _taskFor(index);
        require(t.state == TaskState.Running, "not running");
        require(evidenceHash != bytes32(0), "empty hash");
        require(t.decisionDeadline >= block.timestamp, "past deadline");
        t.state = TaskState.Submitted;
        t.evidenceHash = evidenceHash;
        t.evidenceUri = evidenceUri;
        emit EvidenceSubmitted(index, evidenceHash);
    }

    function decideEvidence(uint256 index, bool accepted, bytes32 reasonHash)
        external
        onlyVerifier
        nonReentrant
    {
        Task storage t = _taskFor(index);
        require(t.state == TaskState.Submitted, "not submitted");
        require(t.decisionDeadline >= block.timestamp, "past deadline");
        t.state = accepted ? TaskState.Accepted : TaskState.Rejected;
        t.reasonHash = reasonHash;
        emit Decision(index, accepted, reasonHash);
        if (!accepted) {
            if (index == 0) refundBase += t.budget;
            else refundBonus += t.budget;
            t.budget = 0;
        }
    }

    function claimTaskPayment(uint256 index) external nonReentrant {
        require(msg.sender == executorPayee, "not payee");
        Task storage t = _taskFor(index);
        require(t.state == TaskState.Accepted, "not accepted");
        uint256 amount = t.budget;
        t.budget = 0;
        t.state = TaskState.Accepted;
        require(IERC20Like(collateralToken).transfer(msg.sender, amount), "pay failed");
        emit Paid(index, msg.sender, amount);
        if (index == 1) planState = PlanState.Finished;
    }

    function expireTask(uint256 index) external nonReentrant {
        Task storage t = _taskFor(index);
        require(t.state == TaskState.Ready || t.state == TaskState.Running, "not expirable");
        require(t.decisionDeadline > 0 && t.decisionDeadline < block.timestamp, "not expired");
        t.state = TaskState.Expired;
        if (index == 0) refundBase += t.budget;
        else refundBonus += t.budget;
        t.budget = 0;
    }

    function closeBonus() external nonReentrant {
        require(bonusTask.state == TaskState.Skipped, "not skipped");
        if (planState != PlanState.Finished) planState = PlanState.Finished;
    }

    // ------------------------------------------------------------------ refund
    /// @notice Claim exact refund. Base collateral is split between matched
    ///         Up/Down shares (pro-rata to the merged amount); bonus collateral is
    ///         split pro-rata across bonus shares. The two pools never cross.
    function claimRefund() external nonReentrant {
        require(isContributor[msg.sender], "not contributor");
        uint256 entitlement = _entitlementOf(msg.sender);
        uint256 already = _refundClaims[msg.sender];
        require(entitlement > already, "nothing new");
        uint256 amount = entitlement - already;
        _refundClaims[msg.sender] = entitlement;
        require(IERC20Like(collateralToken).transfer(msg.sender, amount), "refund failed");
        emit Refunded(msg.sender, amount);
    }

    mapping(address => uint256) private _refundClaims;

    /// @dev Exact entitlement: matched base shares earn base collateral, bonus
    ///      shares earn bonus collateral. Unmatched (surplus) base shares earn
    ///      nothing here — they are returned as shares before activation.
    function _entitlementOf(address account) internal view returns (uint256) {
        Position memory p = positions[account];
        uint256 base = 0;
        if (refundBase > 0 && mergedAmount > 0 && totalBaseUp > 0 && totalBaseDown > 0) {
            uint256 upMatched = (p.baseUp * mergedAmount) / totalBaseUp;
            uint256 downMatched = (p.baseDown * mergedAmount) / totalBaseDown;
            base = ((upMatched + downMatched) * refundBase) / (2 * mergedAmount);
        }

        uint256 bonus = 0;
        if (refundBonus > 0 && totalBonus > 0) {
            bonus = (p.bonus * refundBonus) / totalBonus;
        }
        return base + bonus;
    }

    // ----------------------------------------------------------------- helpers
    function _marketTrading() internal view returns (bool) {
        if (pool == address(0)) return true; // allow pool-less deployments in mocks
        return !IBinaryPool(pool).finalized()
            && !IBinaryMarket(market).isResolved()
            && !IBinaryMarket(market).isVoided();
    }

    function _marketSettled() internal view returns (bool) {
        return IBinaryMarket(market).isResolved() || IBinaryMarket(market).isVoided();
    }

    function _marketSettledOrExpired() internal view returns (bool) {
        if (_marketSettled()) return true;
        if (pool != address(0)) {
            return IBinaryPool(pool).marketExpiryNs() / 1e9 < block.timestamp;
        }
        return false;
    }

    // ------------------------------------------------------------------- views
    function getPosition(address account) external view returns (Position memory) {
        return positions[account];
    }

    function getTask(uint256 index) external view returns (Task memory) {
        return _taskFor(index);
    }
}
