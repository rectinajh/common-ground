# COMMON GROUND — Deployment Evidence

Chain: Somnia Shannon Testnet (`chainId 50312`, hex `0xC488`)
Wallet: `0xB675d67909185f5E983EC51b2AED14667eA31b33`
SDKs: `@somnia-chain/markets-sdk@0.30.0` · `@somnia-chain/reactivity@0.2.1`
Contracts: `packages/contracts`

## 1. Live app

- Vercel (production): <https://commonground-demo.vercel.app>
- Vercel (legacy fallback): <https://common-ground-beige-gamma.vercel.app>
- Vercel project: `common-ground` under `rectinajhs-projects`

## 2. Deployed contracts

| Contract | Address | Tx | Role |
|---|---|---|---|
| `CommonGroundCampaign` (forge deploy, gas-gotcha verified) | `0xe53e5d8945d6c4b771f6eb9add448967d35a8ee9` | `0x7d48e9422af49ec9bbb64d13a0f995664f9a8c82ce955a83da1caaa5d3068e68` | early deploy |
| **`CommonGroundCampaign` (final end-to-end demo)** | **`0xb8d6153b6ca057c3b0f594493058a05f335d3198`** | `0xd431002eab001709a6cbbceb49ce534371f73394c077e2ed16ff8673425cd5a9` | one-plan escrow + task lifecycle |
| `CommonGroundReactivityHandler` | `0x47f4c7fa7176dbc9b337274fa877ac8519aa8b20` | `0xb351dd4b4d190e205e9416df3fe35371a472574dc51a343cabdd7d60ac05d10e` | on-chain settlement trigger |

### Somnia Reactivity subscriptions (live)

The handler is subscribed to the campaign market's `Resolved` / `Voided` events on the
Reactivity precompile (`0x0000000000000000000000000000000000000100`).

| Event | Subscription id | Tx |
|---|---|---|
| `Resolved` | `18086415` | `0x7f0ddf0079c3ee6e0f5f5512849012da1a71f8f486b5d665dd4dfa13a0d23299` |
| `Voided` | `18086423` | `0x2ba2b79c1d1ea87ed4eab8a4a3f2fd7b5bcd1a49eefde6ce1642b992c8e6c07b` |

## 3. End-to-end demo (final campaign)

Bound market id: `0x0000000000000000000000000000000000000000000000000000000000019b12`
(expiry `1789095600`, resolved **Down**)

| Step | Tx |
|---|---|
| Deploy campaign | `0xd431002eab001709a6cbbceb49ce534371f73394c077e2ed16ff8673425cd5a9` |
| Mint complete set (150 tUSDC) | `0xd2cd66550abe5befe127d1aee0553281989749e92cb3c5cdfa8aa3ca42071f0d` |
| setOperator (ERC-6909) | `0x115f23d2d402aa869bee99e08b8ee3f077ff88fedbb5a4e7986be9cb71c8466f` |
| Deposit 100 Up (BASE_UP) | `0x0ff65aaaed82455d748b863e23f25dffb8b83d6f554f3d09b57fd5865afe2848` |
| Deposit 100 Down (BASE_DOWN) | `0x19410c46748379dced0223d4115a054e2dfd38ae45995ccbb2b81fb210fa5440` |
| Deposit 50 Up (BONUS) | `0xec7e86985ff48bd471b0d210e0d63cd3b74220764f1c6014ef813b4c9b6f53cd` |
| `activateBase` (merge) | `0x454119d783de1b77594dbb7ecdb1d67a621899e59232663cd8819f8de856ba0e` |
| `syncMarketAndBonus` (settlement) | `0x232df62a9d3226aea7fbf0a83ab5fcb247b3c4ec1ebc284678138fbf817db73b` |

### Final on-chain state

| Field | Value | Meaning |
|---|---|---|
| `planState` | `1` | BaseActive |
| `baseBudget` | `100000000` (100 tUSDC) | deterministic base budget from merged complementary shares |
| `baseTask.state` | `1` | Ready |
| `bonusBudget` | `0` | Up lost → bonus correctly not funded |
| `bonusTask.state` | `7` | Skipped |

## 4. Somnia Reactivity auto-trigger

Market settlement no longer depends on the off-chain keeper. The handler's `onEvent()` is
callable only by the Reactivity precompile, checks the emitter matches the campaign market,
and advances the campaign once (idempotent).

Reproduce / re-wire a fresh market:

```bash
cd packages/market
npm run build
CAMPAIGN_ADDRESS=0x... node --env-file-if-exists=.env dist/scripts/subscribe-reactivity.js
```

The script deploys the handler (or reuses `HANDLER_ADDRESS`) and subscribes it to both
settlement events. Requirement: the subscription owner keeps ≥ 32 STT.

## 5. DreamDEX integration gates

| Gate | Result | Evidence |
|---|---|---|
| G0 (read) | PASS | 47 markets / 20 binary discovered; `getMarketOnchain` returned correct `status=1`, ids, collateral |
| G0-A (mint/merge) | PASS | faucet 10000 tUSDC → `mintSet` 100 tUSDC = 100 Up + 100 Down → `burnSet` reconciled to the cent |
| G0-B (redeem) | PASS | `syncMarketAndBonus` after settlement redeemed/skipped bonus per on-chain outcome |

## 6. Tests

`forge test`: **18/18 passing** — base happy path, base reject refund, bonus win/loss/void,
task expiry, funding fail, plus security/edge cases (reentrancy, zero-amount, withdraw
insufficient, unequal-merge-min, late-deposit) and the Reactivity handler suite
(advance / idempotent / wrong-emitter / precompile-auth / rollback).

## 7. Contract source verification

Flattened sources are committed under `docs/verification/`. In the Blockscout explorer
(`https://shannon-explorer.somnia.network`), verify each contract via **Flattened source**:

- Compiler: `solc 0.8.24`
- EVM version: `cancun`
- Optimization: enabled, `runs = 200`
- **Via IR: enabled** (the build uses `via_ir = true`)
- Constructor args: leave on autodetect, or paste the encoded args

Files: `CommonGroundCampaign.flattened.sol`, `CommonGroundReactivityHandler.flattened.sol`.

## 8. Demo video script

1. 0–20s — hook: "Two people disagree about the future. Can they fund something together
   instead of betting against each other?"
2. 20–60s — connect wallet → faucet → one-click fund the base task (approve / mint / deposit).
3. 60–100s — activate the base budget (`activateBase`), showing `1 Up + 1 Down = 1 collateral`.
4. 100–140s — after settlement, the bonus resolves automatically (keeper or Reactivity).
5. 140–180s — close: contract addresses, delivery evidence (hash/URI), trust-boundary note.

## 9. Known Somnia gotchas (why these matter for the submission)

1. Deploys cost ~15x the local estimate (~52M gas) — need `--gas-estimate-multiplier 2000`.
2. EIP-1559 base fee can spike above the default estimate — pin `maxFeePerGas=60 gwei`.
3. Consecutive writes need explicit nonce management.
4. Writes must target a market still in `Trading` state (`TradingNotActive` otherwise).
