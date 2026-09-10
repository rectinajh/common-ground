import {
  SomniaMarkets,
  SOMNIA_TESTNET_ADDRESSES,
  type SomniaMarketsConfig,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

/**
 * Somnia × DreamDEX testnet (Shannon, chainId 50312) configuration.
 *
 * The markets indexer is the single source for market discovery; the chain
 * WebSocket powers on-chain reads and writes. `privateKey` is optional and only
 * required for write operations (mint / burn / redeem / faucet).
 */
export const TESTNET_CONFIG = {
  indexerUrl:
    process.env.DREAMDEX_INDEXER_URL ?? "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaShannon,
  wsRpcUrl:
    process.env.DREAMDEX_WS_RPC_URL ??
    "wss://api.infra.testnet.somnia.network/ws",
  addresses: SOMNIA_TESTNET_ADDRESSES,
} as const;

export function createExchange(privateKey?: string): SomniaMarkets {
  const config: SomniaMarketsConfig = {
    indexerUrl: TESTNET_CONFIG.indexerUrl,
    chain: TESTNET_CONFIG.chain,
    wsRpcUrl: TESTNET_CONFIG.wsRpcUrl,
    addresses: TESTNET_CONFIG.addresses,
  };

  if (privateKey) {
    config.privateKey = privateKey as `0x${string}`;
  }

  return new SomniaMarkets(config);
}
