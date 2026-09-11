import {
  isBinaryMarket,
  SOMNIA_TESTNET_ADDRESSES,
  type BinaryMarket,
  type UnifiedMarket,
} from "@somnia-chain/markets-sdk";
import { createExchange } from "../src/config.js";

/**
 * Discover a live, trading binary market and print the exact constructor args
 * for CommonGroundCampaign, plus a deploy-ready JSON snippet.
 *
 *   npm run build --workspace @common-ground/market
 *   node packages/market/dist/scripts/discover-deploy.js
 */

function describe(m: UnifiedMarket): BinaryMarket | null {
  return isBinaryMarket(m.info) ? m.info : null;
}

async function main(): Promise<void> {
  const exchange = createExchange();
  try {
    const markets = await exchange.loadMarkets();
    const trading = Object.values(markets)
      .map((m) => ({ unified: m, binary: describe(m) }))
      .filter((x): x is { unified: UnifiedMarket; binary: BinaryMarket } =>
        Boolean(x.binary) && x.binary.status === "Trading",
      );

    if (trading.length === 0) {
      throw new Error("no Trading binary market found");
    }

    const target = trading[0]!.binary;
    const onchain = await exchange.client.getMarketOnchain(target.marketId);

    const moduleAddr = SOMNIA_TESTNET_ADDRESSES.binaryModule;
    if (!moduleAddr) {
      throw new Error("binaryModule address missing from testnet addresses");
    }

    const deployArgs = {
      module: moduleAddr,
      pool: onchain.pool,
      market: onchain.marketAddress,
      outcomeToken: onchain.outcomeToken,
      collateralToken: onchain.collateral,
      baseUpTokenId: onchain.yesId.toString(),
      baseDownTokenId: onchain.noId.toString(),
      bonusOutcomeIdx: 0,
      operatorId: target.operatorId ?? 0,
      venueId: (target.venueId ?? "0x" + "0".repeat(64)) as string,
      marketId: target.marketId,
      // Fill these from your wallet / team addresses at deploy time.
      executor: "0x0000000000000000000000000000000000000000",
      verifier: "0x0000000000000000000000000000000000000000",
      executorPayee: "0x0000000000000000000000000000000000000000",
      maxContributors: "32",
    };

    console.log("=== deploy target market ===");
    console.log("symbol:", target.id ? target.question : target.asset);
    console.log("status:", target.status, "expiry:", target.expiry);
    console.log("\n=== constructor args (CommonGroundCampaign) ===");
    console.log(JSON.stringify(deployArgs, null, 2));
  } finally {
    await exchange.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[discover-deploy] FAILED:", err);
    process.exit(1);
  });
