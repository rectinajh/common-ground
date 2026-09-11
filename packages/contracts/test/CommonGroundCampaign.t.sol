// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CommonGroundCampaign} from "../src/CommonGroundCampaign.sol";
import {
    MockOutcomeToken,
    MockCollateral,
    MockModule,
    MockMarket,
    MockPool
} from "./mocks/MockDreamDEX.sol";

contract CommonGroundCampaignTest is Test {
    CommonGroundCampaign public campaign;
    MockOutcomeToken public outcomeToken;
    MockCollateral public collateral;
    MockModule public module;
    MockMarket public market;
    MockPool public pool;

    uint256 internal constant YES_ID = 1;
    uint256 internal constant NO_ID = 2;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal executor = address(0xE5EC);
    address internal verifier = address(0x5E1F);
    address internal payee = address(0x9A4E);

    function setUp() public {
        outcomeToken = new MockOutcomeToken();
        collateral = new MockCollateral();
        module = new MockModule(outcomeToken, collateral, YES_ID, NO_ID);
        market = new MockMarket();
        pool = new MockPool(outcomeToken, collateral, YES_ID, NO_ID);

        campaign = new CommonGroundCampaign(
            address(module),
            address(pool),
            address(market),
            address(outcomeToken),
            address(collateral),
            YES_ID, // baseUpTokenId
            NO_ID, // baseDownTokenId
            0, // bonusOutcomeIdx = Up
            1, // operatorId
            bytes32(0), // venueId
            bytes32("m1"), // marketId
            executor,
            verifier,
            payee,
            32 // maxContributors
        );

        // Fund contributors and approve the campaign as operator.
        outcomeToken.mint(alice, YES_ID, 100);
        outcomeToken.mint(bob, NO_ID, 100);
        vm.prank(alice);
        outcomeToken.setOperator(address(campaign), true);
        vm.prank(bob);
        outcomeToken.setOperator(address(campaign), true);
    }

    function testHappyPathBaseTask() public {
        vm.prank(alice);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseUp, 100);
        vm.prank(bob);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseDown, 100);

        campaign.activateBase();
        assertEq(campaign.baseBudget(), 100);
        assertEq(collateral.balanceOf(address(campaign)), 100);

        uint256 startAt = block.timestamp;
        vm.prank(executor);
        campaign.startTask(0, startAt + 10, startAt + 100);

        vm.prank(executor);
        campaign.submitEvidence(0, keccak256("evidence"), "ipfs://x");

        vm.prank(verifier);
        campaign.decideEvidence(0, true, bytes32(0));

        uint256 before = collateral.balanceOf(payee);
        vm.prank(payee);
        campaign.claimTaskPayment(0);
        assertEq(collateral.balanceOf(payee), before + 100);
    }

    function testBaseRejectRefunds() public {
        vm.prank(alice);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseUp, 100);
        vm.prank(bob);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseDown, 100);
        campaign.activateBase();

        uint256 startAt = block.timestamp;
        vm.prank(executor);
        campaign.startTask(0, startAt + 10, startAt + 100);
        vm.prank(executor);
        campaign.submitEvidence(0, keccak256("evidence"), "ipfs://x");
        vm.prank(verifier);
        campaign.decideEvidence(0, false, bytes32(0));

        assertEq(campaign.refundPool(), 100);
        uint256 aliceBefore = collateral.balanceOf(alice);
        vm.prank(alice);
        campaign.claimRefund();
        assertEq(collateral.balanceOf(alice), aliceBefore + 50);
    }
}
