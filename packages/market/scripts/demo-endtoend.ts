import {
  isBinaryMarket,
  SomniaMarkets,
  SOMNIA_TESTNET_ADDRESSES,
  type BinaryMarket,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Abi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * End-to-end live demo on Shannon testnet.
 *
 *   node dist/scripts/demo-endto-end.js 1   # discover -> deploy -> mint -> deposit -> activate
 *   node dist/scripts/demo-endto-end.js 2   # wait for settlement -> sync bonus -> report
 *
 * One wallet simulates both the Up and Down contributors for the mechanics demo.
 */

const RPC = "https://dream-rpc.somnia.network";
const STATE_FILE = new URL("../.demo-state.json", import.meta.url);
const UNIT = 10n ** 6n; // tUSDC 6 decimals
// Somnia EIP-1559: pin a generous fee ceiling (base fee ~6 gwei, can spike).
const FEES = { maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n };

const erc6909Abi = parseAbi([
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function setOperator(address spender, bool approved) returns (bool)",
  "function transferFrom(address sender, address receiver, uint256 id, uint256 amount) returns (bool)",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const poolMintAbi = parseAbi([
  "function mintSet(address yesTo, address noTo, uint256 amount)",
]);

const marketAbi = parseAbi([
  "function isResolved() view returns (bool)",
  "function isVoided() view returns (bool)",
]);

type DemoState = {
  campaign: Address;
  market: Address;
  marketId: string;
  expiry: number;
};

function readCampaignAbi(): Abi {
  const path = new URL(
    "../../../contracts/out/CommonGroundCampaign.sol/CommonGroundCampaign.json",
    import.meta.url,
  );
  return JSON.parse(readFileSync(path, "utf8")).abi as Abi;
}

function readCampaignBytecode(): `0x${string}` {
  const path = new URL(
    "../../../contracts/out/CommonGroundCampaign.sol/CommonGroundCampaign.json",
    import.meta.url,
  );
  const artifact = JSON.parse(readFileSync(path, "utf8"));
  const bytecode: string = artifact.bytecode.object;
  return (bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`) as `0x${string}`;
}

async function discover(exchange: SomniaMarkets) {
  await exchange.loadMarkets();
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  let target: BinaryMarket | null = null;
  for (const m of Object.values(exchange.markets)) {
    const b = isBinaryMarket(m.info) ? m.info : null;
    if (!b || b.status !== "Trading") continue;
    const expiry = BigInt(b.expiry);
    if (expiry - nowSec < 300n) continue; // need >=5min buffer for deploy+mint+merge
    // Pick the soonest-expiring market with enough buffer (settles fast for Stage 2).
    if (target === null || expiry < BigInt(target.expiry)) {
      target = b;
    }
  }
  if (target === null) throw new Error("no Trading binary market with >=5min buffer");
  const onchain = await exchange.client.getMarketOnchain(target.marketId);
  return { target, onchain };
}

async function main(): Promise<void> {
  const stage = process.argv[2] ?? "1";
  const privateKey = process.env.DREAMDEX_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error("DREAMDEX_PRIVATE_KEY missing");

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: somniaShannon, transport: http(RPC) });
  const walletClient = createWalletClient({
    chain: somniaShannon,
    transport: http(RPC),
    account,
  });
  const campaignAbi = readCampaignAbi();

  if (stage === "1") {
    const exchange = new SomniaMarkets({
      indexerUrl: process.env.DREAMDEX_INDEXER_URL ?? "https://dev.smk.somnia.host/v1/graphql",
      chain: somniaShannon,
      wsRpcUrl: process.env.DREAMDEX_WS_RPC_URL ?? "wss://api.infra.testnet.somnia.network/ws",
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });

    const { target, onchain } = await discover(exchange);
    const moduleAddr = SOMNIA_TESTNET_ADDRESSES.binaryModule!;
    let nonce = await publicClient.getTransactionCount({ address: account.address });

    console.log("=== market ===");
    console.log("marketId:", target.marketId);
    console.log("expiry:", target.expiry, "status:", target.status);

    console.log("=== deploy campaign ===");
    const deployArgs = [
      moduleAddr,
      onchain.pool,
      onchain.marketAddress,
      onchain.outcomeToken,
      onchain.collateral,
      onchain.yesId,
      onchain.noId,
      0, // bonusOutcomeIdx = Up
      target.operatorId ?? 0,
      (target.venueId ?? ("0x" + "0".repeat(64))) as `0x${string}`,
      target.marketId,
      account.address,
      account.address,
      account.address,
      32,
    ] as const;
    const deployHash = await walletClient.deployContract({
      account,
      ...FEES,
      nonce: nonce++,
      abi: campaignAbi,
      bytecode: readCampaignBytecode(),
      args: deployArgs,
      gas: 60_000_000n,
    });
    const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const campaign = deployReceipt.contractAddress!;
    console.log("campaign:", campaign);
    console.log("deploy tx:", deployHash);

    console.log("=== mint complete set (150 tUSDC -> 150 Up + 150 Down) ===");
    await walletClient.writeContract({
      account,
      ...FEES,
      nonce: nonce++,
      address: onchain.collateral,
      abi: erc20Abi,
      functionName: "approve",
      args: [onchain.pool, 150n * UNIT],
      gas: 15_000_000n,
    });
    const mintHash = await walletClient.writeContract({
      account,
      ...FEES,
      nonce: nonce++,
      address: onchain.pool,
      abi: poolMintAbi,
      functionName: "mintSet",
      args: [account.address, account.address, 150n * UNIT],
      gas: 30_000_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    console.log("mint tx:", mintHash);

    console.log("=== authorize campaign as ERC-6909 operator ===");
    const opHash = await walletClient.writeContract({
      account,
      ...FEES,
      nonce: nonce++,
      address: onchain.outcomeToken,
      abi: erc6909Abi,
      functionName: "setOperator",
      args: [campaign, true],
      gas: 15_000_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash: opHash });
    console.log("setOperator tx:", opHash);

    console.log("=== deposit: 100 Up (BASE_UP), 100 Down (BASE_DOWN), 50 Up (BONUS) ===");
    for (const [bucket, amount] of [
      [0, 100n * UNIT],
      [1, 100n * UNIT],
      [2, 50n * UNIT],
    ] as const) {
      const h = await walletClient.writeContract({
        account,
        ...FEES,
        nonce: nonce++,
        address: campaign,
        abi: campaignAbi,
        functionName: "deposit",
        args: [bucket, amount],
        gas: 20_000_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
      console.log(`deposit bucket=${bucket} tx=${h}`);
    }

    console.log("=== activateBase (merge 100 Up + 100 Down -> 100 tUSDC base budget) ===");
    const activateHash = await walletClient.writeContract({
      account,
      ...FEES,
      nonce: nonce++,
      address: campaign,
      abi: campaignAbi,
      functionName: "activateBase",
      gas: 30_000_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash: activateHash });
    console.log("activateBase tx:", activateHash);

    const baseBudget = await publicClient.readContract({
      address: campaign,
      abi: campaignAbi,
      functionName: "baseBudget",
    });
    console.log("baseBudget:", baseBudget, "(expected 100000000)");

    const state: DemoState = {
      campaign,
      market: onchain.marketAddress,
      marketId: target.marketId,
      expiry: Number(target.expiry),
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log("state saved ->", STATE_FILE.pathname);
    console.log("\nNow run: node dist/scripts/demo-endto-end.js 2   (after the market settles)");
    await exchange.close();
    return;
  }

  if (stage === "2") {
    const state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as DemoState;
    console.log("=== waiting for market settlement ===");
    console.log("campaign:", state.campaign);

    for (;;) {
      const resolved = await publicClient.readContract({
        address: state.market,
        abi: marketAbi,
        functionName: "isResolved",
      });
      const voided = await publicClient.readContract({
        address: state.market,
        abi: marketAbi,
        functionName: "isVoided",
      });
      if (resolved || voided) {
        console.log("settled: resolved =", resolved, "voided =", voided);
        break;
      }
      const now = Math.floor(Date.now() / 1000);
      console.log(`not settled yet (expiry ${state.expiry}, now ${now}); waiting 30s…`);
      await new Promise((r) => setTimeout(r, 30_000));
    }

    console.log("=== syncMarketAndBonus ===");
    const syncHash = await walletClient.writeContract({
      account,
      ...FEES,
      address: state.campaign,
      abi: campaignAbi,
      functionName: "syncMarketAndBonus",
      gas: 30_000_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash: syncHash });
    console.log("sync tx:", syncHash);

    const bonusBudget = await publicClient.readContract({
      address: state.campaign,
      abi: campaignAbi,
      functionName: "bonusBudget",
    });
    console.log("bonusBudget:", bonusBudget, "(0 = bonus lost/void, >0 = bonus funded)");
    return;
  }

  throw new Error("usage: demo-endto-end.js [1|2]");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[demo] FAILED:", err);
    process.exit(1);
  });
