/**
 * COMMON GROUND — Somnia Reactivity auto-trigger wiring.
 *
 * Subscribes a deployed CommonGroundReactivityHandler to its campaign's DreamDEX
 * BinaryMarket `Resolved` / `Voided` events. Once subscribed, market settlement
 * invokes the handler's `onEvent()` on-chain and advances the campaign with zero
 * off-chain keepers, crons, or scripts.
 *
 * This script talks to the Somnia Reactivity precompile directly (with the
 * ABI/types shipped by @somnia-chain/reactivity) because the chain's fee
 * estimation needs explicit EIP-1559 fees; the equivalent official SDK call is
 * `new SDK({ public, wallet }).subscribe({ handlerContractAddress, filter, options })`.
 *
 * Usage (after `forge script DeployReactivityHandler --broadcast`):
 *   DREAMDEX_PRIVATE_KEY=... HANDLER_ADDRESS=0x... CAMPAIGN_ADDRESS=0x... \
 *     npm run build && node --env-file-if-exists=.env dist/scripts/subscribe-reactivity.js
 */
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseAbi,
  toEventSelector,
  toFunctionSelector,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { readFileSync } from "node:fs";

const RPC = process.env.DREAMDEX_RPC_URL ?? "https://dream-rpc.somnia.network";
const PRIVATE_KEY = process.env.DREAMDEX_PRIVATE_KEY as `0x${string}`;
const HANDLER = (process.env.HANDLER_ADDRESS ?? "") as Address;
const CAMPAIGN = process.env.CAMPAIGN_ADDRESS as Address;

// Somnia Reactivity precompile (same address the SDK targets).
const REACTIVITY_PRECOMPILE = "0x0000000000000000000000000000000000000100" as const;
const ZERO = `0x${"0".repeat(64)}` as Hex;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as Address;

const FEES = { maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n };
const CALLBACK_FEES = { maxFeePerGas: 60_000_000_000n, priorityFeePerGas: 2_000_000_000n };
const CALLBACK_GAS = 10_000_000n;

const campaignAbi = parseAbi([
  "function market() view returns (address)",
  "function planState() view returns (uint8)",
]);

const handlerAbi = parseAbi([
  "constructor(address campaign_)",
  "function campaign() view returns (address)",
  "function consumed() view returns (bool)",
  "function onEvent(address emitter, bytes32[] eventTopics, bytes data)",
]);

const precompileAbi = parseAbi([
  "function subscribe((bytes32[4] eventTopics,address origin,address caller,address emitter,address handlerContractAddress,bytes4 handlerFunctionSelector,uint64 priorityFeePerGas,uint64 maxFeePerGas,uint64 gasLimit,bool isGuaranteed,bool isCoalesced)) returns (uint256 subscriptionId)",
  "function getSubscriptionInfo(uint256) view returns ((bytes32[4] eventTopics,address origin,address caller,address emitter,address handlerContractAddress,bytes4 handlerFunctionSelector,uint64 priorityFeePerGas,uint64 maxFeePerGas,uint64 gasLimit,bool isGuaranteed,bool isCoalesced) subscriptionData, address owner)",
  "event SubscriptionCreated(uint256 indexed subscriptionId, address indexed owner, (bytes32[4] eventTopics,address origin,address caller,address emitter,address handlerContractAddress,bytes4 handlerFunctionSelector,uint64 priorityFeePerGas,uint64 maxFeePerGas,uint64 gasLimit,bool isGuaranteed,bool isCoalesced) subscriptionData)",
]);

const RESOLVED_SELECTOR = toEventSelector("Resolved(uint32,uint256[])");
const VOIDED_SELECTOR = toEventSelector("Voided()");
const ON_EVENT_SELECTOR = toFunctionSelector("onEvent(address,bytes32[],bytes)");

function readHandlerBytecode(): Hex {
  const path = new URL(
    "../../../../packages/contracts/out/CommonGroundReactivityHandler.sol/CommonGroundReactivityHandler.json",
    import.meta.url,
  );
  const json = JSON.parse(readFileSync(path, "utf8")) as { bytecode: { object: Hex } };
  return json.bytecode.object;
}

function buildSubscriptionData(handler: Address, emitter: Address, topic: Hex) {
  return {
    eventTopics: [topic, ZERO, ZERO, ZERO] as [Hex, Hex, Hex, Hex],
    origin: ZERO_ADDR,
    caller: ZERO_ADDR,
    emitter,
    handlerContractAddress: handler,
    handlerFunctionSelector: ON_EVENT_SELECTOR,
    ...CALLBACK_FEES,
    gasLimit: CALLBACK_GAS,
    isGuaranteed: false,
    isCoalesced: false,
  };
}

async function main(): Promise<void> {
  if (!PRIVATE_KEY) throw new Error("DREAMDEX_PRIVATE_KEY missing");
  if (!CAMPAIGN) throw new Error("CAMPAIGN_ADDRESS missing");

  const account = privateKeyToAccount(PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: somniaShannon, transport: http(RPC) });
  const walletClient = createWalletClient({ chain: somniaShannon, transport: http(RPC), account });

  let handler = HANDLER;
  let nonce = await publicClient.getTransactionCount({ address: account.address });

  if (!handler) {
    const deployHash = await walletClient.deployContract({
      account,
      ...FEES,
      nonce: nonce++,
      abi: handlerAbi,
      bytecode: readHandlerBytecode(),
      args: [CAMPAIGN],
      gas: 5_000_000n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    handler = receipt.contractAddress!;
    console.log("deployed handler:", handler, "tx:", deployHash);
  }

  const market = (await publicClient.readContract({
    address: CAMPAIGN,
    abi: campaignAbi,
    functionName: "market",
  })) as Address;

  console.log("handler:", handler);
  console.log("campaign:", CAMPAIGN);
  console.log("market:", market);
  console.log("resolved selector:", RESOLVED_SELECTOR);
  console.log("voided selector:", VOIDED_SELECTOR);

  const ids: bigint[] = [];

  for (const [label, topic] of [
    ["Resolved", RESOLVED_SELECTOR],
    ["Voided", VOIDED_SELECTOR],
  ] as const) {
    const data = buildSubscriptionData(handler, market, topic);
    const hash = await walletClient.writeContract({
      account,
      ...FEES,
      nonce: nonce++,
      address: REACTIVITY_PRECOMPILE,
      abi: precompileAbi,
      functionName: "subscribe",
      args: [data],
      gas: 5_000_000n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const created = receipt.logs
      .map((log) => {
        try {
          return decodeEventLog({ abi: precompileAbi, data: log.data, topics: log.topics });
        } catch {
          return null;
        }
      })
      .find((d) => d?.eventName === "SubscriptionCreated");
    if (!created) throw new Error(`no SubscriptionCreated event in ${label} tx ${hash}`);
    const subscriptionId = (created.args as { subscriptionId: bigint }).subscriptionId;
    ids.push(subscriptionId);
    console.log(`${label} subscribed: id=${subscriptionId} tx=${hash}`);
  }

  console.log("subscriptionIds:", ids.join(", "));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("subscribe-reactivity FAILED:", err);
    process.exit(1);
  });
