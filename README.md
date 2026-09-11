# COMMON GROUND

> **1 Up + 1 Down = 1 collateral.** Two people who disagree about the future don't have
> to bet against each other — they jointly fund real action.

COMMON GROUND is a **conditional public-action protocol** built on **Somnia × DreamDEX
Event Contracts**. Contributors deposit Up/Down outcome shares of the same market into a
shared plan. Complementary shares merge into a deterministic **base budget** that funds a
real task *before* settlement, while a separate **bonus bucket** funds a second task only
if the market resolves the pre-agreed way.

## Status

- ✅ Testnet working prototype — full live end-to-end demo passed
- ✅ DreamDEX integration: read (G0), mint/merge (G0-A), redeem (G0-B)
- ✅ Somnia Reactivity auto-trigger live on-chain (no off-chain keeper)
- ✅ 23/23 Foundry tests passing
- 🌐 Live app: <https://commonground-demo.vercel.app>

## Why

DreamDEX Event Contracts issue Up/Down outcome shares for a market over a fixed window.
Today most products use them only as a betting terminal: deposit, wait, settle, cash out.

But an event contract is more than a lottery ticket. If Up and Down shares can be merged
into deterministic collateral, then people who disagree about the future can **jointly
fund something worth doing regardless of the outcome** — without either side conceding
first.

## A concrete scenario

A protocol needs a $50k security audit but can't fund it through donations alone. It opens
an event market, and both bulls and bears deposit positions.

- **Unconditional:** matched Up + Down merge into deterministic funding that pays the audit
  no matter which way the market moves — nobody has to admit the other is right.
- **Conditional:** only if a milestone is hit does a deeper follow-up pentest / bug-bounty
  bonus get released.
- **Accountable:** the executor's artifact (report + reproducible manifest) is committed
  on-chain, a verifier confirms it, and only then is payment released. Failure refunds per
  the pre-agreed rules.

The first demo ran this as a **Community Maintenance Check**: base task = regression and
permission checks on a fixed commit; bonus task = boundary / exception checks.

## Problems solved

1. **Opposing views can't fund anything together.** Alice is bullish, Bob is bearish.
   Centralized setups force one to concede or hand money to a coordinator. Here both
   contribute complementary shares; the contract does the merge.

2. **Research, maintenance, and audit work lacks delivery accountability.** Users fear
   providers will delete the post, change the claim, or refuse a refund when the result is
   unfavorable. COMMON GROUND escrows funds and requires on-chain evidence plus a
   verifier's decision before payment.

3. **Market outcomes never become real-world action.** Settlement usually ends at "won or
   lost." COMMON GROUND compiles the outcome into a concrete next step: release the bonus,
   or refund and move on.

## How it works

1. **Complementary shares → deterministic base budget.** Matched Up + Down shares are
   merged (`1 Up + 1 Down = 1 collateral`) into a budget that funds the base task regardless
   of direction — no one has to admit the other is right.

2. **Two-stage tasks.** The base task starts as soon as it's funded; the bonus task starts
   only after settlement and only if direction, budget, delivery, and deadline conditions
   all hold. No "maybe" — only pre-written conditions.

3. **An immutable Plan Manifest.** Market, amounts, executor, verifier, payee, and deadlines
   are frozen at deploy. No admin, no upgrade path, no arbitrary call that can redirect
   funds.

4. **Explicit failure and refund paths.** Unfunded, voided, expired, rejected, or failed
   tasks each have a defined recovery rule. Refunds don't depend on anyone's goodwill.

5. **Settlement triggers on-chain, automatically.** A shared
   `CommonGroundReactivityHandler` keeps a `market => campaign` registry, subscribes to each
   market's `Resolved`/`Voided` events on the Somnia Reactivity precompile, and on settlement
   advances the matching campaign with **no off-chain keeper, cron, or script**.

## On-chain evidence (live testnet demo)

Chain: **Somnia Shannon testnet** (`chainId 50312`, hex `0xC488`) · RPC
`https://dream-rpc.somnia.network`

### Deployed contracts

| Contract | Address | Role |
|---|---|---|
| `CommonGroundCampaign` (final demo) | `0x5dcfe02bc151a8cbf77d2b069e55c6286561dea1` | one-plan escrow + task lifecycle |
| `CommonGroundFactory` | `0x63bFD49DbB74A1f731229258fF76495E3b2d8F90` | permissionless plan factory + registry |
| `CommonGroundReactivityHandler` (multi-plan) | `0xd5dae8eed198aca44f34974c4a2afd45a1d43e37` | on-chain settlement trigger |

### End-to-end demo transactions

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

- `baseBudget = 100 tUSDC` — deterministic, from merged complementary shares
- `planState = Finished` — the market **voided** (uniform `50/50` payout)
- `bonusBudget = 0`, `bonusTask = Skipped` — on a uniform void the bonus is redeemed
  at half; `refundBonus = 25 tUSDC` is returned to the bonus contributor

### Reactivity auto-trigger (Somnia native)

| Purpose | Address / subscription id | Tx |
|---|---|---|
| Handler deploy | `0xd5dae8eed198aca44f34974c4a2afd45a1d43e37` | `0x6df577fc227a92e14e471e1f4a106465262a7f0932da9d4e89c59074f24444d0` |
| Register campaign → market | — | `0x168cab945723e3fa739e565a698c60d674e39e330cccf32ebcf4d8f314cb8600` |
| Subscribe `Resolved` | id `18413600` | `0x062efbd1ddffe675fb08858507a25eabbcc1cba9faeb3b7086e84137038b0e36` |
| Subscribe `Voided` | id `18413616` | `0x2766a2378da4e3531d41d8d660b729b73e09ebd218ad6ee8d09140f0dfb70c52` |

Full deployment evidence, integration gates, verification steps, and demo-video script:
[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Repo layout

```text
apps/web/                plan, contribution, evidence, exit UI
apps/worker/             permissionless keeper (fallback trigger)
packages/contracts/      campaign, factory/registry, Reactivity handler, adapters, tests
packages/market/         SDK wrappers, deploy + subscribe scripts
docs/                    PRD, technical, integration, deployment, optimization
```

## Docs

- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — addresses, tx records, integration gates, verification
- [docs/TECHNICAL.md](./docs/TECHNICAL.md) — architecture, state machines, invariants
- [docs/INTEGRATION.md](./docs/INTEGRATION.md) — DreamDEX SDK verification notes
- [docs/OPTIMIZATION.md](./docs/OPTIMIZATION.md) — P0–P2 roadmap + status
- [docs/PITCH.md](./docs/PITCH.md) — DoraHacks BUIDL paste + video beats
- [docs/SDK_FEEDBACK.md](./docs/SDK_FEEDBACK.md) — DreamDEX / Somnia SDK notes
- [docs/COMMON_GROUND_PRD_v1.0.md](./docs/COMMON_GROUND_PRD_v1.0.md) — full product spec

## Quick start

```bash
npm install
npm run spike:market            # read-only: discover markets + read on-chain state
```

Write path (mint/burn/redeem) needs a funded test wallet and STT gas:

```bash
DREAMDEX_PRIVATE_KEY=0x... npm run spike:market -- --write
```

Reproduce the Reactivity wiring:

```bash
cd packages/market && npm run build
CAMPAIGN_ADDRESS=0x... node --env-file-if-exists=.env dist/scripts/subscribe-reactivity.js
```

## Scope & known limitations

- One plan ↔ one market; one base task and at most one bonus task
- Max 32 contributor addresses
- Zero platform fee in this version
- No yield guarantee and no compensation for losing the market direction
- Refunds are split exactly per bucket: matched base shares settle against `refundBase`,
  bonus shares against `refundBonus` — the two pools never cross
- 6-decimal testnet collateral is hardcoded; mainnet 18-decimal config is a next milestone

## License

TBD. This repository is for the Somnia × DreamDEX Event Contracts hackathon — design,
development, and demo.
