import { defineChain, parseAbi } from "viem";

export const CHAIN = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://dream-rpc.somnia.network"] } },
});

// WebSocket RPC for live (real-time) state updates; falls back to polling.
export const WS_RPC = "wss://api.infra.testnet.somnia.network/ws";

// Official Somnia testnet faucet (STT, the native gas token).
export const STT_FAUCET_URL = "https://testnet.somnia.network/";

// Latest live P0 demo campaign. Swap for a fresh one when re-deploying.
export const DEMO_CAMPAIGN = "0x5dcfe02bc151a8cbf77d2b069e55c6286561dea1";
export const HANDLER_ADDRESS = "0xd5dae8eed198aca44f34974c4a2afd45a1d43e37";
export const EXPLORER = "https://shannon-explorer.somnia.network";

// Permissionless plan factory + registry (live).
export const FACTORY_ADDRESS = "0x63bFD49DbB74A1f731229258fF76495E3b2d8F90";

// Collateral decimals. Shannon testnet tUSDC is 6; mainnet USDso is 18.
export const COLLATERAL_DECIMALS = 6;
export const UNIT = 10n ** BigInt(COLLATERAL_DECIMALS);

// Shannon testnet tUSDC (collateral) and STT native token.
export const T_USDC = "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E";

export const campaignAbi = parseAbi([
  "function baseBudget() view returns (uint256)",
  "function bonusBudget() view returns (uint256)",
  "function planState() view returns (uint8)",
  "function totalBaseUp() view returns (uint256)",
  "function totalBaseDown() view returns (uint256)",
  "function totalBonus() view returns (uint256)",
  "function contributorCount() view returns (uint256)",
  "function mergedAmount() view returns (uint256)",
  "function market() view returns (address)",
  "function pool() view returns (address)",
  "function outcomeToken() view returns (address)",
  "function collateralToken() view returns (address)",
  "function baseUpTokenId() view returns (uint256)",
  "function baseDownTokenId() view returns (uint256)",
  "function bonusTokenId() view returns (uint256)",
  "function bonusOutcomeIdx() view returns (uint8)",
  "function operatorId() view returns (uint32)",
  "function venueId() view returns (bytes32)",
  "function marketId() view returns (bytes32)",
  "function module() view returns (address)",
  "function getTask(uint256) view returns ((uint8 state, bytes32 evidenceHash, string evidenceUri, bytes32 reasonHash, uint256 startDeadline, uint256 decisionDeadline, uint256 budget))",
  "function deposit(uint8 bucket, uint256 amount)",
  "function activateBase()",
  "function syncMarketAndBonus()",
]);

export const factoryAbi = parseAbi([
  "function campaignCount() view returns (uint256)",
  "function getCampaign(uint256) view returns (address)",
  "function isCampaign(address) view returns (bool)",
  "function createPlan(address module,address pool,address market,address outcomeToken,address collateralToken,uint256 baseUpTokenId,uint256 baseDownTokenId,uint8 bonusOutcomeIdx,uint32 operatorId,bytes32 venueId,bytes32 marketId,address executor,address verifier,address executorPayee,uint256 maxContributors) returns (address)",
  "event PlanCreated(address indexed campaign, address indexed creator, bytes32 indexed marketId)",
]);

export const outcomeTokenAbi = parseAbi([
  "function setOperator(address spender, bool approved) returns (bool)",
]);

export const collateralAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function faucet(uint256 amount)",
]);

export const poolAbi = parseAbi([
  "function mintSet(address yesTo, address noTo, uint256 amount)",
]);
