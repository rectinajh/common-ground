// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CommonGroundCampaign} from "../src/CommonGroundCampaign.sol";
import {CommonGroundReactivityHandler} from "../src/CommonGroundReactivityHandler.sol";

/// @notice Deploy a CommonGroundReactivityHandler bound to one campaign.
///         Usage:
///           CAMPAIGN_ADDRESS=0x... forge script DeployReactivityHandler \
///             --rpc-url $RPC --private-key $KEY --broadcast
contract DeployReactivityHandler is Script {
    function run() external returns (CommonGroundReactivityHandler handler) {
        address campaign_ = vm.envAddress("CAMPAIGN_ADDRESS");

        vm.startBroadcast();
        handler = new CommonGroundReactivityHandler();
        CommonGroundCampaign campaign = CommonGroundCampaign(campaign_);
        handler.register(campaign.market(), campaign);
        vm.stopBroadcast();

        console2.log("CommonGroundReactivityHandler deployed at:", address(handler));
        console2.log("Bound to campaign:", campaign_);
    }
}
