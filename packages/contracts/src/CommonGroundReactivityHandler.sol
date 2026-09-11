// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommonGroundCampaign} from "./CommonGroundCampaign.sol";

/// @title CommonGroundReactivityHandler
/// @notice Somnia Reactivity on-chain handler shared across many plans. One
///         handler maintains a `market => campaign` registry; each plan registers
///         its campaign and the protocol subscribes this handler to that market's
///         `Resolved` / `Voided` events. On settlement the Somnia precompile calls
///         `onEvent` and the handler advances the matching campaign — no off-chain
///         keeper, cron, or script.
/// @dev The handler is a thin dispatcher: it can only call a campaign's
///      permissionless `syncMarketAndBonus()`, only for a registered market, and
///      only once per market.
contract CommonGroundReactivityHandler {
    /// Somnia Reactivity precompile — the only account allowed to invoke
    /// `onEvent` (mirrors the `SomniaEventHandler` base contract).
    address internal constant SOMNIA_REACTIVITY_PRECOMPILE =
        0x0000000000000000000000000000000000000100;

    /// @notice Protocol operator that wires market → campaign mappings.
    address public immutable owner;

    /// @notice market address => campaign to advance when that market settles.
    mapping(address => CommonGroundCampaign) public campaigns;

    /// @notice market address => settlement already consumed.
    mapping(address => bool) public consumed;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /// @notice Register a campaign for the market it was deployed against.
    function register(address market, CommonGroundCampaign campaign_) external onlyOwner {
        require(address(campaign_) != address(0), "zero campaign");
        require(campaign_.market() == market, "market mismatch");
        campaigns[market] = campaign_;
    }

    /// @dev Somnia Reactivity entrypoint. `emitter` is the contract that emitted
    ///      the watched event; `eventTopics` and `data` are the raw log fields.
    function onEvent(
        address emitter,
        bytes32[] calldata /* eventTopics */,
        bytes calldata /* data */
    ) external {
        require(msg.sender == SOMNIA_REACTIVITY_PRECOMPILE, "not precompile");
        CommonGroundCampaign campaign_ = campaigns[emitter];
        require(address(campaign_) != address(0), "unregistered");
        require(campaign_.market() == emitter, "market mismatch");
        if (consumed[emitter]) return;
        consumed[emitter] = true;
        // Rolls back (including `consumed`) if the market is not settled or the
        // plan is not active yet, so a late/early callback can safely retry.
        campaign_.syncMarketAndBonus();
    }
}
