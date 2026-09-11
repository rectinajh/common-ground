import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  type Abi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";

/**
 * COMMON GROUND keeper. Polls one campaign and calls its permissionless advance
 * functions when the on-chain state warrants it. Never holds a key that can move
 * funds off-plan and never declares a market result — the campaign reads that
 * from the market contract itself.
 *
 *   npm run start        # watch loop, poll every 15s
 *   npm run once         # single pass, exit
 */

const RPC = process.env.RPC_URL ?? "https://dream-rpc.somnia.network";
const CAMPAIGN = (process.env.CAMPAIGN_ADDRESS ?? "") as Address;
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const FEES = { maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n };
const POLL_MS = 15_000;
const chain = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

// PlanState: Open=0 BaseActive=1 Finished=2 FundingFailed=3 Refundable=4
// TaskState: Waiting=0 Ready=1 Running=2 Submitted=3 Accepted=4 Rejected=5 Expired=6 Skipped=7

const marketAbi = parseAbi([
  "function isResolved() view returns (bool)",
  "function isVoided() view returns (bool)",
]);

function readCampaignAbi(): Abi {
  const path = new URL(
    "../../../packages/contracts/out/CommonGroundCampaign.sol/CommonGroundCampaign.json",
    import.meta.url,
  );
  return JSON.parse(readFileSync(path, "utf8")).abi as Abi;
}

type Task = readonly [number, string, string, bigint, bigint, bigint];

async function decide(
  publicClient: ReturnType<typeof createPublicClient>,
  campaignAbi: Abi,
): Promise<{ fn: string; args?: unknown[]; label: string } | null> {
  const planState = (await publicClient.readContract({
    address: CAMPAIGN,
    abi: campaignAbi,
    functionName: "planState",
  })) as number;

  const market = (await publicClient.readContract({
    address: CAMPAIGN,
    abi: campaignAbi,
    functionName: "market",
  })) as Address;
  const resolved = (await publicClient.readContract({
    address: market,
    abi: marketAbi,
    functionName: "isResolved",
  })) as boolean;
  const voided = (await publicClient.readContract({
    address: market,
    abi: marketAbi,
    functionName: "isVoided",
  })) as boolean;
  const settled = resolved || voided;

  if (planState === 1 && settled) {
    return { fn: "syncMarketAndBonus", label: "market settled -> syncMarketAndBonus" };
  }
  if (planState === 0 && settled) {
    return { fn: "failFunding", label: "market settled while Open -> failFunding" };
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  for (const i of [0, 1]) {
    const t = (await publicClient.readContract({
      address: CAMPAIGN,
      abi: campaignAbi,
      functionName: "getTask",
      args: [i],
    })) as Task;
    const state = t[0];
    const decisionDeadline = t[4];
    if ((state === 1 || state === 2) && decisionDeadline > 0n && decisionDeadline < now) {
      return { fn: "expireTask", args: [i], label: `task ${i} deadline passed -> expireTask` };
    }
  }

  return null;
}

async function main(): Promise<void> {
  if (!CAMPAIGN || CAMPAIGN === ("0x" + "0".repeat(40))) {
    throw new Error("CAMPAIGN_ADDRESS not set");
  }
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set");

  const account = privateKeyToAccount(PRIVATE_KEY);
  const publicClient = createPublicClient({ chain, transport: http(RPC) });
  const walletClient = createWalletClient({ chain, transport: http(RPC), account });
  const campaignAbi = readCampaignAbi();
  const once = process.argv.includes("--once");

  console.log(`[worker] watching campaign ${CAMPAIGN} (${once ? "once" : "loop"})`);

  for (;;) {
    const action = await decide(publicClient, campaignAbi);
    if (action) {
      console.log(`[worker] ${action.label}`);
      const nonce = await publicClient.getTransactionCount({ address: account.address });
      const hash = await walletClient.writeContract({
        account,
        ...FEES,
        nonce,
        address: CAMPAIGN,
        abi: campaignAbi,
        functionName: action.fn,
        args: action.args ?? [],
        gas: 30_000_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`[worker] ${action.fn} tx=${hash}`);
    } else {
      console.log("[worker] no advance needed");
    }

    if (once) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[worker] FAILED:", err);
    process.exit(1);
  });
