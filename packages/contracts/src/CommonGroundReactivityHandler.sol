// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommonGroundCampaign} from "./CommonGroundCampaign.sol";

/// @title CommonGroundReactivityHandler
/// @notice Somnia Reactivity on-chain handler. Subscribe this contract to a
///         DreamDEX BinaryMarket `Resolved` / `Voided` event and the Somnia
///         precompile will invoke `onEvent` automatically — no off-chain keeper,
///         no cron, no script. The handler simply advances the attached campaign.
/// @dev One handler per campaign keeps the trust boundary minimal: the only
///      effect it can ever have is calling the campaign's permissionless
///      `syncMarketAndBonus()`, and it can only do so once, for the exact
///      market the campaign was deployed against.
contract CommonGroundReactivityHandler {
    /// Somnia Reactivity precompile — the only account allowed to invoke
    /// `onEvent` (mirrors the `SomniaEventHandler` base contract).
    address internal constant SOMNIA_REACTIVITY_PRECOMPILE =
        0x0000000000000000000000000000000000000100;

    /// @notice The campaign this handler advances when its market settles.
    CommonGroundCampaign public immutable campaign;

    /// @notice True once a settlement event has been consumed successfully.
    bool public consumed;

    constructor(CommonGroundCampaign campaign_) {
        require(address(campaign_) != address(0), "zero campaign");
        campaign = campaign_;
    }

    /// @dev Somnia Reactivity entrypoint. `emitter` is the contract that emitted
    ///      the watched event; `eventTopics` and `data` are the raw log fields.
    function onEvent(
        address emitter,
        bytes32[] calldata /* eventTopics */,
        bytes calldata /* data */
    ) external {
        require(msg.sender == SOMNIA_REACTIVITY_PRECOMPILE, "not precompile");
        // Defence in depth: even if a subscription is misconfigured, the handler
        // refuses to advance the campaign for a different market's event.
        require(emitter == campaign.market(), "wrong emitter");
        if (consumed) return;
        consumed = true;
        // Rolls back (including `consumed`) if the market is not settled or the
        // plan is not active yet, so a late/early callback can safely retry.
        campaign.syncMarketAndBonus();
    }
}
