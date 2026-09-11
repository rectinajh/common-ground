// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommonGroundCampaign} from "./CommonGroundCampaign.sol";

/// @title CommonGroundFactory
/// @notice Permissionless factory + registry. Anyone can launch a plan; every
///         deployed campaign is recorded so frontends can list and discover plans.
/// @dev One campaign per plan (non-upgradeable, no admin on the campaign itself).
///      The factory is a thin, append-only registry — it cannot move funds or
///      change an existing campaign.
contract CommonGroundFactory {
    CommonGroundCampaign[] public campaigns;
    mapping(address => bool) public isCampaign;
    mapping(address => address[]) public campaignsByCreator;

    event PlanCreated(
        address indexed campaign,
        address indexed creator,
        bytes32 indexed marketId
    );

    /// @notice Deploy a new campaign and register it.
    /// @return The freshly deployed campaign.
    function createPlan(
        address module,
        address pool,
        address market,
        address outcomeToken,
        address collateralToken,
        uint256 baseUpTokenId,
        uint256 baseDownTokenId,
        uint8 bonusOutcomeIdx,
        uint32 operatorId,
        bytes32 venueId,
        bytes32 marketId,
        address executor,
        address verifier,
        address executorPayee,
        uint256 maxContributors
    ) external returns (CommonGroundCampaign) {
        CommonGroundCampaign campaign = new CommonGroundCampaign(
            module,
            pool,
            market,
            outcomeToken,
            collateralToken,
            baseUpTokenId,
            baseDownTokenId,
            bonusOutcomeIdx,
            operatorId,
            venueId,
            marketId,
            executor,
            verifier,
            executorPayee,
            maxContributors
        );

        campaigns.push(campaign);
        isCampaign[address(campaign)] = true;
        campaignsByCreator[msg.sender].push(address(campaign));
        emit PlanCreated(address(campaign), msg.sender, marketId);
        return campaign;
    }

    /// @notice Number of plans registered.
    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }

    /// @notice Read a campaign by index (enumerable registry).
    function getCampaign(uint256 index) external view returns (CommonGroundCampaign) {
        return campaigns[index];
    }
}
