// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CommonGroundCampaign} from "../src/CommonGroundCampaign.sol";
import {
    MockOutcomeToken,
    MockCollateral,
    MockModule,
    MockMarket,
    MockPool,
    ReentrantOutcomeToken
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

    // ------------------------------------------------------------------ helpers

    /// @dev Funds base (100 Up + 100 Down) and bonus (50 Up), then activates.
    function fund() internal {
        outcomeToken.mint(alice, YES_ID, 150);
        outcomeToken.mint(bob, NO_ID, 100);
        vm.prank(alice);
        outcomeToken.setOperator(address(campaign), true);
        vm.prank(bob);
        outcomeToken.setOperator(address(campaign), true);

        vm.prank(alice);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseUp, 100);
        vm.prank(alice);
        campaign.deposit(CommonGroundCampaign.Bucket.Bonus, 50);
        vm.prank(bob);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseDown, 100);

        campaign.activateBase();
        assertEq(campaign.baseBudget(), 100);
    }

    // ------------------------------------------------------------- bonus branch

    function testBonusWinFundsBonus() public {
        fund();
        market.setResolved(1, 0); // Up wins
        campaign.syncMarketAndBonus();

        assertEq(campaign.bonusBudget(), 50);
        (CommonGroundCampaign.TaskState state,,,,,) = campaign.bonusTask();
        assertEq(uint8(state), 1); // Ready
    }

    function testBonusLossSkipsBonus() public {
        fund();
        market.setResolved(0, 1); // Down wins
        campaign.syncMarketAndBonus();

        assertEq(campaign.bonusBudget(), 0);
        (CommonGroundCampaign.TaskState state,,,,,) = campaign.bonusTask();
        assertEq(uint8(state), 7); // Skipped
    }

    function testBonusVoidRefundsHalf() public {
        fund();
        market.setVoided();
        campaign.syncMarketAndBonus();

        assertEq(campaign.bonusBudget(), 0);
        (CommonGroundCampaign.TaskState state,,,,,) = campaign.bonusTask();
        assertEq(uint8(state), 7); // Skipped
        assertEq(campaign.refundPool(), 25); // 50 / 2
    }

    // --------------------------------------------------------------- task expiry

    function testExpireTaskRefunds() public {
        fund();
        uint256 startAt = block.timestamp;
        vm.prank(executor);
        campaign.startTask(0, startAt + 10, startAt + 100);

        vm.warp(startAt + 200);
        campaign.expireTask(0);

        assertEq(campaign.refundPool(), 100);
        (CommonGroundCampaign.TaskState state,,,,,) = campaign.baseTask();
        assertEq(uint8(state), 6); // Expired
    }

    // ------------------------------------------------------------- funding fail

    function testFundingFailsWhenSettled() public {
        outcomeToken.mint(alice, YES_ID, 100);
        outcomeToken.mint(bob, NO_ID, 100);
        vm.prank(alice);
        outcomeToken.setOperator(address(campaign), true);
        vm.prank(bob);
        outcomeToken.setOperator(address(campaign), true);
        vm.prank(alice);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseUp, 100);
        vm.prank(bob);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseDown, 100);

        market.setResolved(1, 0);
        campaign.failFunding();

        assertEq(uint8(campaign.planState()), 3); // FundingFailed
    }

    // ----------------------------------------------------------- edge / security

    function testDepositZeroAmountReverts() public {
        vm.prank(alice);
        vm.expectRevert(bytes("zero amount"));
        campaign.deposit(CommonGroundCampaign.Bucket.BaseUp, 0);
    }

    function testDepositAfterActivationReverts() public {
        fund();
        outcomeToken.mint(alice, YES_ID, 1);
        vm.prank(alice);
        vm.expectRevert(bytes("not open"));
        campaign.deposit(CommonGroundCampaign.Bucket.Bonus, 1);
    }

    function testWithdrawInsufficientReverts() public {
        outcomeToken.mint(alice, YES_ID, 5);
        vm.prank(alice);
        outcomeToken.setOperator(address(campaign), true);
        vm.prank(alice);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseUp, 5);
        vm.prank(alice);
        vm.expectRevert(bytes("insufficient"));
        campaign.withdraw(CommonGroundCampaign.Bucket.BaseUp, 6);
    }

    function testUnequalSidesMergeMin() public {
        outcomeToken.mint(alice, YES_ID, 150);
        outcomeToken.mint(bob, NO_ID, 100);
        vm.prank(alice);
        outcomeToken.setOperator(address(campaign), true);
        vm.prank(bob);
        outcomeToken.setOperator(address(campaign), true);
        vm.prank(alice);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseUp, 150);
        vm.prank(bob);
        campaign.deposit(CommonGroundCampaign.Bucket.BaseDown, 100);

        campaign.activateBase();
        assertEq(campaign.baseBudget(), 100);
        assertEq(campaign.mergedAmount(), 100);
    }

    function testReentrancyGuard() public {
        ReentrantOutcomeToken rt = new ReentrantOutcomeToken();
        CommonGroundCampaign c2 = new CommonGroundCampaign(
            address(module),
            address(pool),
            address(market),
            address(rt),
            address(collateral),
            YES_ID,
            NO_ID,
            0,
            1,
            bytes32(0),
            bytes32("m1"),
            executor,
            verifier,
            payee,
            32
        );
        rt.setTarget(c2);

        vm.prank(alice);
        vm.expectRevert(bytes("reentrant"));
        c2.deposit(CommonGroundCampaign.Bucket.BaseUp, 1);
    }
}
