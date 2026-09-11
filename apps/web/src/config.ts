import { defineChain, parseAbi } from "viem";

export const CHAIN = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://dream-rpc.somnia.network"] } },
});

// Latest live P0 demo campaign. Swap for a fresh one when re-deploying.
export const DEMO_CAMPAIGN = "0xb8d6153b6ca057c3b0f594493058a05f335d3198";

export const UNIT = 10n ** 6n;

// Shannon testnet tUSDC (collateral) and STT native token.
export const T_USDC = "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E";

export const campaignAbi = parseAbi([
  "function baseBudget() view returns (uint256)",
  "function bonusBudget() view returns (uint256)",
  "function planState() view returns (uint8)",
  "function totalBaseUp() view returns (uint256)",
  "function totalBaseDown() view returns (uint256)",
  "function totalBonus() view returns (uint256)",
  "function market() view returns (address)",
  "function pool() view returns (address)",
  "function outcomeToken() view returns (address)",
  "function collateralToken() view returns (address)",
  "function baseUpTokenId() view returns (uint256)",
  "function baseDownTokenId() view returns (uint256)",
  "function bonusTokenId() view returns (uint256)",
  "function getTask(uint256) view returns (uint8,bytes32,string,uint256,uint256,uint256)",
  "function deposit(uint8 bucket, uint256 amount)",
  "function activateBase()",
  "function syncMarketAndBonus()",
]);

export const outcomeTokenAbi = parseAbi([
  "function setOperator(address spender, bool approved) returns (bool)",
]);

export const collateralAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

export const poolAbi = parseAbi([
  "function mintSet(address yesTo, address noTo, uint256 amount)",
]);
