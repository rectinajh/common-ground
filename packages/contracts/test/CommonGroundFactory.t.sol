// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CommonGroundCampaign} from "../src/CommonGroundCampaign.sol";
import {CommonGroundFactory} from "../src/CommonGroundFactory.sol";
import {
    MockOutcomeToken,
    MockCollateral,
    MockModule,
    MockMarket,
    MockPool
} from "./mocks/MockDreamDEX.sol";

contract CommonGroundFactoryTest is Test {
    CommonGroundFactory public factory;
    MockOutcomeToken public outcomeToken;
    MockCollateral public collateral;
    MockModule public module;
    MockMarket public market;
    MockPool public pool;

    uint256 internal constant YES_ID = 1;
    uint256 internal constant NO_ID = 2;

    address internal creator = address(0xC4EA);
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
        factory = new CommonGroundFactory();
    }

    function createPlan() internal returns (CommonGroundCampaign) {
        vm.prank(creator);
        return factory.createPlan(
            address(module),
            address(pool),
            address(market),
            address(outcomeToken),
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
    }

    function testCreatePlanRegistersCampaign() public {
        CommonGroundCampaign c = createPlan();

        assertEq(factory.campaignCount(), 1);
        assertEq(address(factory.getCampaign(0)), address(c));
        assertEq(factory.isCampaign(address(c)), true);
        assertEq(factory.campaignsByCreator(creator, 0), address(c));
        assertEq(c.executor(), executor);
        assertEq(c.verifier(), verifier);
        assertEq(c.executorPayee(), payee);
    }

    function testDeployedCampaignIsFunctional() public {
        CommonGroundCampaign c = createPlan();

        outcomeToken.mint(alice, YES_ID, 100);
        outcomeToken.mint(bob, NO_ID, 100);
        vm.prank(alice);
        outcomeToken.setOperator(address(c), true);
        vm.prank(bob);
        outcomeToken.setOperator(address(c), true);
        vm.prank(alice);
        c.deposit(CommonGroundCampaign.Bucket.BaseUp, 100);
        vm.prank(bob);
        c.deposit(CommonGroundCampaign.Bucket.BaseDown, 100);

        c.activateBase();
        assertEq(c.baseBudget(), 100);
    }
}
