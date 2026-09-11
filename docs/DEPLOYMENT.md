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
| **`CommonGroundCampaign` (final end-to-end demo)** | **`0x5dcfe02bc151a8cbf77d2b069e55c6286561dea1`** | `0x9f5e002ed86153e16f682d98e74270d495eaf2c8c79ecf060eb8e9e56be66a01` | one-plan escrow + task lifecycle |
| `CommonGroundFactory` | `0x63bFD49DbB74A1f731229258fF76495E3b2d8F90` | `0x13e9f6b5a515c95c8e6cbd0fffbf1efa442586a60b05702fe0974cc1dc2621bf` | permissionless plan factory + registry |
| `CommonGroundReactivityHandler` (multi-plan) | `0xd5dae8eed198aca44f34974c4a2afd45a1d43e37` | `0x6df577fc227a92e14e471e1f4a106465262a7f0932da9d4e89c59074f24444d0` | on-chain settlement trigger |

### Somnia Reactivity subscriptions (live)

The handler is a `market => campaign` registry subscribed to the campaign market's
`Resolved` / `Voided` events on the Reactivity precompile
(`0x0000000000000000000000000000000000000100`).

| Event | Subscription id | Tx |
|---|---|---|
| Register campaign → market | — | `0x168cab945723e3fa739e565a698c60d674e39e330cccf32ebcf4d8f314cb8600` |
| `Resolved` | `18413600` | `0x062efbd1ddffe675fb08858507a25eabbcc1cba9faeb3b7086e84137038b0e36` |
| `Voided` | `18413616` | `0x2766a2378da4e3531d41d8d660b729b73e09ebd218ad6ee8d09140f0dfb70c52` |

## 3. End-to-end demo (final campaign)

Bound market: "Will agent Alpha-Z close session #35 with a higher NAV?"
market id `0x000000000000000000000000000000000000000000000000000000000001a726`
(expiry `1789157797`, resolved **Voided** — uniform `50/50` payout)

| Step | Tx |
|---|---|
| Deploy campaign | `0x9f5e002ed86153e16f682d98e74270d495eaf2c8c79ecf060eb8e9e56be66a01` |
| Mint complete set (150 tUSDC) | `0x5c3030368abaeb18ea5668bd8f3be626be5208cf3ead222b90e98a722c50ebcb` |
| setOperator (ERC-6909) | `0x0cca46d3cb6879eb3bdabce6e755faeb7fd920748b80dbd71e03df9eb71e9a12` |
| Deposit 100 Up (BASE_UP) | `0xc50206d6a8a7310f637b55751a1a8476b995ee0b83c3f7329f0c46d4e7e06cdb` |
| Deposit 100 Down (BASE_DOWN) | `0x92670cbdc59d530df42c4fe2971490942597006abd03c37452da0ec3867670f1` |
| Deposit 50 Up (BONUS) | `0xa738d10535028650bf8c30140c6963a7692503501715a82ef8fdc9c0928813a6` |
| `activateBase` (merge) | `0x818c6c747a7b995bd0574e6b25f6a90090b8356c966e8190bcefd90000c19180` |
| Reactivity `onEvent` → `syncMarketAndBonus` (void) | `0x6555af95969a94b4c830f8dbcb736929204f8b73c63da6d09828412a14755cbe` |

### Final on-chain state

| Field | Value | Meaning |
|---|---|---|
| `planState` | `2` | Finished |
| `baseBudget` | `100000000` (100 tUSDC) | deterministic base budget from merged complementary shares |
| `baseTask.state` | `1` | Ready |
| `bonusBudget` | `0` | void → bonus correctly not funded |
| `bonusTask.state` | `7` | Skipped |
| `refundBonus` | `25000000` (25 tUSDC) | uniform void refunds half of the 50 tUSDC bonus |

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

`forge test`: **23/23 passing** — base happy path, base reject refund, bonus win/loss/void,
task expiry, funding fail, exact refund (base/bonus pools never cross), plus security/edge
cases (reentrancy, zero-amount, withdraw insufficient, unequal-merge-min, late-deposit),
the factory suite (deploy + register + functional campaign), and the Reactivity handler
registry suite (advance / idempotent / unregistered-emitter / market-mismatch /
precompile-auth / owner-auth / rollback).

> Note: the final demo campaign `0x5dcfe02b…1dea1` is deployed from the **current**
> revision — it stores the verifier's `reasonHash` in `Task` and splits refunds into
> `refundBase` / `refundBonus` for exact per-bucket accounting. The earlier revision
> (campaign `0xb8d6153b…3198`) predates those two changes.

## 6.1 CI

GitHub Actions (`.github/workflows/ci.yml`) runs `forge test` (Foundry) plus the market,
worker, and web TypeScript builds on every push and pull request.

## 7. Contract source verification

Flattened sources are committed under `docs/verification/`. In the Blockscout explorer
(`https://shannon-explorer.somnia.network`), verify each contract via **Flattened source**:

- Compiler: `solc 0.8.24`
- EVM version: `cancun`
- Optimization: enabled, `runs = 200`
- **Via IR: enabled** (the build uses `via_ir = true`)
- Constructor args: leave on autodetect, or paste the encoded args

Files: `CommonGroundCampaign.flattened.sol`, `CommonGroundReactivityHandler.flattened.sol`.

## 8. Demo video

Recorded file: [`docs/demo/COMMON-GROUND-demo.mp4`](./demo/COMMON-GROUND-demo.mp4)
(2:31, 1080p, English). Upload to YouTube unlisted for DoraHacks.

### Script (2:00–2:30, English)

Do **not** start with MetaMask. Judges will not connect a wallet.

1. 0:00–0:20 — hook on a black card: “Two people disagree about the future. Can they
   fund something together instead of betting against each other?”
2. 0:20–0:50 — open https://commonground-demo.vercel.app (English). Point at the
   judge strip, then the completed-run timeline. Click `tx ↗` on merge and settlement.
3. 0:50–1:20 — mechanism: Alice Up + Bob Down → `activateBase` → 100 tUSDC locked
   *before* the market moves. Base task is already funded.
4. 1:20–1:50 — settlement: market resolved Down. Bonus skipped. Say the words
   “Somnia Reactivity, no keeper.” Show handler address.
5. 1:50–2:20 — close: factory + campaign + “this is Event Contract volume for a
   real audit, not another PnL board.” Future: permissionless plans on every market.

Recording notes: 1920×1080, cursor large, no desktop clutter, no Chinese unless you
flip the language toggle at the end for one second.

## 9. Known Somnia gotchas (why these matter for the submission)

1. Deploys cost ~15x the local estimate (~52M gas) — need `--gas-estimate-multiplier 2000`.
2. EIP-1559 base fee can spike above the default estimate — pin `maxFeePerGas=60 gwei`.
3. Consecutive writes need explicit nonce management.
4. Writes must target a market still in `Trading` state (`TradingNotActive` otherwise).
