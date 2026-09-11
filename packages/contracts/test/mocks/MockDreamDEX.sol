// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockOutcomeToken {
    mapping(address => mapping(uint256 => uint256)) public balanceOf;
    mapping(address => mapping(address => bool)) public isOperator;

    function mint(address to, uint256 id, uint256 amount) external {
        balanceOf[to][id] += amount;
    }

    function burn(address from, uint256 id, uint256 amount) external {
        require(balanceOf[from][id] >= amount, "burn over");
        balanceOf[from][id] -= amount;
    }

    function setOperator(address spender, bool approved) external returns (bool) {
        isOperator[msg.sender][spender] = approved;
        return true;
    }

    function transfer(address receiver, uint256 id, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender][id] >= amount, "transfer over");
        balanceOf[msg.sender][id] -= amount;
        balanceOf[receiver][id] += amount;
        return true;
    }

    function transferFrom(
        address sender,
        address receiver,
        uint256 id,
        uint256 amount
    ) external returns (bool) {
        require(isOperator[sender][msg.sender], "not operator");
        require(balanceOf[sender][id] >= amount, "transferFrom over");
        balanceOf[sender][id] -= amount;
        balanceOf[receiver][id] += amount;
        return true;
    }
}

contract MockCollateral {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "transfer over");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        require(balanceOf[from] >= amount, "transferFrom over");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockModule {
    MockOutcomeToken public immutable outcomeToken;
    MockCollateral public immutable collateral;
    uint256 public immutable yesId;
    uint256 public immutable noId;

    constructor(MockOutcomeToken o_, MockCollateral c_, uint256 yesId_, uint256 noId_) {
        outcomeToken = o_;
        collateral = c_;
        yesId = yesId_;
        noId = noId_;
    }

    function redeem(
        uint32,
        bytes32,
        bytes32,
        uint8 outcomeIdx,
        uint256 amount
    ) external {
        uint256 id = outcomeIdx == 0 ? yesId : noId;
        outcomeToken.burn(msg.sender, id, amount);
        collateral.mint(msg.sender, amount);
    }
}

contract MockMarket {
    bool public isResolved;
    bool public isVoided;
    uint256 public yesPayout;
    uint256 public noPayout;

    function setResolved(uint256 yes, uint256 no) external {
        isResolved = true;
        yesPayout = yes;
        noPayout = no;
    }

    function setVoided() external {
        isVoided = true;
    }

    function payoutNumerators() external view returns (uint256[] memory) {
        uint256[] memory n = new uint256[](2);
        n[0] = yesPayout;
        n[1] = noPayout;
        return n;
    }
}

contract MockPool {
    MockOutcomeToken public immutable outcomeToken;
    MockCollateral public immutable collateral;
    uint256 public immutable yesId;
    uint256 public immutable noId;
    bool public finalized;
    uint64 public expiryNs;

    constructor(MockOutcomeToken o_, MockCollateral c_, uint256 yesId_, uint256 noId_) {
        outcomeToken = o_;
        collateral = c_;
        yesId = yesId_;
        noId = noId_;
    }

    function setFinalized(bool f) external {
        finalized = f;
    }

    function setExpiryNs(uint64 e) external {
        expiryNs = e;
    }

    function marketExpiryNs() external view returns (uint64) {
        return expiryNs;
    }

    function burnSet(uint256 amount) external {
        outcomeToken.burn(msg.sender, yesId, amount);
        outcomeToken.burn(msg.sender, noId, amount);
        collateral.mint(msg.sender, amount);
    }
}
