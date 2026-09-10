// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-6909 result-share singleton (Up/Down live here as token ids).
interface IOutcomeToken6909 {
    function balanceOf(address owner, uint256 id) external view returns (uint256);
    function isOperator(address owner, address spender) external view returns (bool);
    function setOperator(address spender, bool approved) external returns (bool);
    function transfer(address receiver, uint256 id, uint256 amount) external returns (bool);
    function transferFrom(
        address sender,
        address receiver,
        uint256 id,
        uint256 amount
    ) external returns (bool);
}

/// @notice Module-routed complete-set merge and settlement redemption (v2 path).
interface IBinaryMarketsModule {
    function mergeCompleteSet(
        uint32 operatorId,
        bytes32 venueId,
        bytes32 marketId,
        uint256 amount
    ) external;

    function redeem(
        uint32 operatorId,
        bytes32 venueId,
        bytes32 marketId,
        uint8 outcomeIdx,
        uint256 amount
    ) external;
}

/// @notice The per-window market contract carrying the authoritative settlement state.
interface IBinaryMarket {
    function isResolved() external view returns (bool);
    function isVoided() external view returns (bool);
    function payoutNumerators() external view returns (uint256[] memory);
}

struct BinaryPoolParams {
    address collateralToken;
    address market;
    address outcomeToken;
    uint256 yesId;
    uint256 noId;
    uint256 oneCollateral;
    uint256 setBacking;
    address feeRecipient;
    uint256 makerFeeBpsTimes1k;
    uint256 takerFeeBpsTimes1k;
    uint256 maxBuilderFeeBpsTimes1k;
    uint256 settlementFeeBpsTimes1k;
    address settlement;
    uint64 marketNonce;
    bool finalized;
}

interface IBinaryPool {
    function getBinaryPoolParams() external view returns (BinaryPoolParams memory);
    function marketExpiryNs() external view returns (uint64);
    function finalized() external view returns (bool);
}

interface IERC20Like {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
