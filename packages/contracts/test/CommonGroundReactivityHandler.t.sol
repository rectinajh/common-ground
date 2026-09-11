// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CommonGroundCampaign} from "../src/CommonGroundCampaign.sol";
import {CommonGroundReactivityHandler} from "../src/CommonGroundReactivityHandler.sol";
import {
    MockOutcomeToken,
    MockCollateral,
    MockModule,
    MockMarket,
    MockPool
} from "./mocks/MockDreamDEX.sol";

contract CommonGroundReactivityHandlerTest is Test {
    CommonGroundCampaign public campaign;
    CommonGroundReactivityHandler public handler;
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
    address internal constant PRE = 0x0000000000000000000000000000000000000100;

    bytes32[] internal emptyTopics;
    bytes internal emptyData;

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
            YES_ID,
            NO_ID,
            0, // bonusOutcomeIdx = Up
            1,
            bytes32(0),
            bytes32("m1"),
            executor,
            verifier,
            payee,
            32
        );
        handler = new CommonGroundReactivityHandler(campaign);
    }

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
    }

    /// @dev Simulate the reactivity precompile invoking the handler.
    function fire(address emitter) internal {
        vm.prank(PRE);
        handler.onEvent(emitter, emptyTopics, emptyData);
    }

    function testOnEventAdvancesBonusWhenMarketResolvesUp() public {
        fund();
        market.setResolved(1, 0); // Up wins == bonus side

        fire(address(market));

        assertEq(campaign.bonusBudget(), 50);
        (CommonGroundCampaign.TaskState state,,,,,) = campaign.bonusTask();
        assertEq(uint8(state), 1); // Ready
        assertEq(handler.consumed(), true);
    }

    function testOnEventSkipsBonusWhenMarketResolvesDown() public {
        fund();
        market.setResolved(0, 1); // Down wins != bonus side

        fire(address(market));

        assertEq(campaign.bonusBudget(), 0);
        (CommonGroundCampaign.TaskState state,,,,,) = campaign.bonusTask();
        assertEq(uint8(state), 7); // Skipped
    }

    function testOnEventIsIdempotent() public {
        fund();
        market.setResolved(1, 0);

        fire(address(market));
        // A duplicate callback (e.g. both Resolved and Voided filters matched, or a
        // retry) must not redeem the bonus side twice.
        fire(address(market));

        assertEq(campaign.bonusBudget(), 50);
        assertEq(handler.consumed(), true);
    }

    function testOnEventRevertsForWrongEmitter() public {
        fund();
        market.setResolved(1, 0);

        vm.expectRevert(bytes("wrong emitter"));
        fire(address(0xBEEF));
    }

    function testOnEventBeforeSettlementRollsBackConsumed() public {
        fund();
        // Market still trading: syncMarketAndBonus reverts, so the handler's
        // `consumed` flag must also roll back and allow a later retry.
        vm.expectRevert(bytes("not settled"));
        fire(address(market));

        assertEq(handler.consumed(), false);
    }

    function testOnEventRejectsNonPrecompileCaller() public {
        fund();
        market.setResolved(1, 0);

        vm.expectRevert(bytes("not precompile"));
        handler.onEvent(address(market), emptyTopics, emptyData);
    }
}
