// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CommonGroundCampaign} from "../src/CommonGroundCampaign.sol";

/// @notice Deploy CommonGroundCampaign against one discovered live Shannon market.
///         Re-run `discover-deploy.js` to refresh the market params before a fresh deploy.
contract DeployCampaign is Script {
    // Roles are the deployer's own test wallet for the demo. Use distinct addresses
    // for a real run (the verifier must be independent of the executor).
    address internal constant EXECUTOR = 0xB675d67909185f5E983EC51b2AED14667eA31b33;
    address internal constant VERIFIER = 0xB675d67909185f5E983EC51b2AED14667eA31b33;
    address internal constant PAYEE = 0xB675d67909185f5E983EC51b2AED14667eA31b33;

    function run() external returns (CommonGroundCampaign campaign) {
        vm.startBroadcast();

        campaign = new CommonGroundCampaign(
            0x3ecC694Cef705358864a646142ac17A90E29e388, // module (BinaryMarketsModule)
            0x5397cd6DE6e87eB7f2D9B72191B5eFfb16E53D62, // pool
            0x6fa1aC96FCE3862afa73CD92ea5e385C7bfAE718, // market
            0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9, // outcomeToken (ERC-6909)
            0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E, // collateralToken (tUSDC)
            0x0000005397cd6de6e87eb7f2d9b72191b5effb16e53d62000000000000018700, // baseUpTokenId
            0x0000005397cd6de6e87eb7f2d9b72191b5effb16e53d62000000000000018701, // baseDownTokenId
            0, // bonusOutcomeIdx = Up
            4, // operatorId
            0x1a1e6821cde7d0159c0d293177871e09677b4e42307c7db3ba94f8648a5a050f, // venueId
            0x0000000000000000000000000000000000000000000000000000000000019af8, // marketId
            EXECUTOR,
            VERIFIER,
            PAYEE,
            32 // maxContributors
        );

        vm.stopBroadcast();
        console2.log("CommonGroundCampaign deployed at:", address(campaign));
    }
}
