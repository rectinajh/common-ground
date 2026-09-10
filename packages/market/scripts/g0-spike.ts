import {
  isBinaryMarket,
  type BinaryMarket,
  type UnifiedMarket,
} from "@somnia-chain/markets-sdk";
import { privateKeyToAccount } from "viem/accounts";
import { createExchange } from "../src/config.js";

/**
 * G0 integration spike.
 *
 * Goals:
 *  - G0 (read): discover binary markets from the indexer and read one market's
 *    live on-chain state (status / outcome ids / collateral).
 *  - G0-A/B (write, optional): faucet collateral, mint a complete set, read the
 *    resulting ERC-6909 outcome balances, then burn the set back to collateral.
 *
 * Usage:
 *   npm run spike:market                 # read-only verification
 *   DREAMDEX_PRIVATE_KEY=0x... npm run spike:market -- --write
 */

function log(msg: string, ...rest: unknown[]): void {
  console.log(`[G0] ${msg}`, ...rest);
}

function describeMarket(m: UnifiedMarket): BinaryMarket | null {
  return isBinaryMarket(m.info) ? m.info : null;
}

async function main(): Promise<void> {
  const doWrite = process.argv.includes("--write");
  const privateKey = process.env.DREAMDEX_PRIVATE_KEY?.trim();

  if (doWrite && !privateKey) {
    throw new Error(
      "--write requires DREAMDEX_PRIVATE_KEY (a dedicated, funded testnet wallet).",
    );
  }

  const exchange = createExchange(privateKey);
  try {
    log("loading markets from indexer…");
    const markets = await exchange.loadMarkets();
    const symbols = Object.keys(markets);
    const binaries = Object.values(markets).filter((m) => m.type === "binary");

    log(
      `loaded ${symbols.length} markets total, ${binaries.length} binary outcome markets`,
    );

    const trading = binaries
      .map((m) => ({ unified: m, binary: describeMarket(m) }))
      .filter((x): x is { unified: UnifiedMarket; binary: BinaryMarket } =>
        Boolean(x.binary),
      )
      .filter((x) => x.binary.status === "Trading");

    log(`found ${trading.length} binary markets currently in "Trading" status`);

    for (const { unified, binary } of binaries
      .map((m) => ({ unified: m, binary: describeMarket(m) }))
      .filter((x): x is { unified: UnifiedMarket; binary: BinaryMarket } =>
        Boolean(x.binary),
      )
      .slice(0, 5)) {
      console.log(
        `  - ${unified.symbol}\n      status=${binary.status} expiry=${binary.expiry} asset=${binary.asset}\n      question=${binary.question}`,
      );
    }

    if (trading.length === 0) {
      log("no Trading market available; on-chain state read skipped");
      return;
    }

    const target = trading[0]!.binary;
    log(`reading on-chain state for marketId=${target.marketId}`);

    const onchain = await exchange.client.getMarketOnchain(target.marketId);
    console.log("  MarketOnchain =", {
      marketAddress: onchain.marketAddress,
      outcomeToken: onchain.outcomeToken,
      yesId: onchain.yesId.toString(),
      noId: onchain.noId.toString(),
      pool: onchain.pool,
      collateral: onchain.collateral,
      status: onchain.status,
      expiry: onchain.expiry.toString(),
      decimals: onchain.decimals,
      isResolved: onchain.isResolved,
      isVoided: onchain.isVoided,
      winningOutcome: onchain.winningOutcome,
    });

    if (!doWrite) {
      log(
        "read-only G0 passed. Run with DREAMDEX_PRIVATE_KEY + --write to verify the mint/burn round trip.",
      );
      return;
    }

    const account = privateKeyToAccount(privateKey! as `0x${string}`);
    const owner = account.address;
    const unit = 10n ** BigInt(onchain.decimals);

    log(`write path: account=${owner}`);

    const beforeCollateral = await exchange.client.getErc20Balance(
      onchain.collateral,
      owner,
    );
    log(`collateral balance before faucet=${beforeCollateral.toString()}`);

    const faucetAmount = 10_000n * unit;
    log(`requesting faucet ${faucetAmount.toString()} collateral…`);
    await exchange.trader.faucet({ amount: faucetAmount });

    const afterFaucet = await exchange.client.getErc20Balance(
      onchain.collateral,
      owner,
    );
    log(`collateral balance after faucet=${afterFaucet.toString()}`);

    const setAmount = 100n * unit;
    log(`minting a complete set (${setAmount.toString()} collateral)…`);
    await exchange.trader.mintSet({ pool: onchain.pool, amount: setAmount });

    const yesBal = await exchange.client.getOutcomeBalance({
      outcomeToken: onchain.outcomeToken,
      account: owner,
      id: onchain.yesId,
    });
    const noBal = await exchange.client.getOutcomeBalance({
      outcomeToken: onchain.outcomeToken,
      account: owner,
      id: onchain.noId,
    });
    log(
      `after mint: YES=${yesBal.toString()} NO=${noBal.toString()} (expected ${setAmount.toString()} each)`,
    );

    log("burning the complete set back to collateral…");
    await exchange.trader.burnSet({ pool: onchain.pool, amount: setAmount });

    const finalCollateral = await exchange.client.getErc20Balance(
      onchain.collateral,
      owner,
    );
    log(`collateral balance after burn=${finalCollateral.toString()}`);

    log("G0-A/B write round trip completed successfully.");
  } finally {
    await exchange.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[G0] FAILED:", err);
    process.exit(1);
  });
