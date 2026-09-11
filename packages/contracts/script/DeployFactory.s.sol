// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CommonGroundFactory} from "../src/CommonGroundFactory.sol";

/// @notice Deploy the permissionless plan factory + registry.
///         Usage:
///           forge script DeployFactory --rpc-url $RPC --private-key $KEY --broadcast
contract DeployFactory is Script {
    function run() external returns (CommonGroundFactory factory) {
        vm.startBroadcast();
        factory = new CommonGroundFactory();
        vm.stopBroadcast();
        console2.log("CommonGroundFactory deployed at:", address(factory));
    }
}
