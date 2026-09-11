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
- ✅ 18/18 Foundry tests passing
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
| `CommonGroundCampaign` (final demo) | `0xb8d6153b6ca057c3b0f594493058a05f335d3198` | one-plan escrow + task lifecycle |
| `CommonGroundFactory` | `0x63bFD49DbB74A1f731229258fF76495E3b2d8F90` | permissionless plan factory + registry |
| `CommonGroundReactivityHandler` (multi-plan) | `0xd5dae8eed198aca44f34974c4a2afd45a1d43e37` | on-chain settlement trigger |

### End-to-end demo transactions

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

- `baseBudget = 100 tUSDC` — deterministic, from merged complementary shares
- `bonusBudget = 0`, `bonusTask = Skipped` — the market resolved **Down**, so the
  Up-conditioned bonus was correctly not released

### Reactivity auto-trigger (Somnia native)

| Purpose | Address / subscription id | Tx |
|---|---|---|
| Handler deploy | `0xd5dae8eed198aca44f34974c4a2afd45a1d43e37` | `0x6df577fc227a92e14e471e1f4a106465262a7f0932da9d4e89c59074f24444d0` |
| Register campaign → market | — | `0x8e4ebb3735e3b1a8f79098a707f97c4352a811d98a6a0a48db603584a4b664a4` |
| Subscribe `Resolved` | id `18392207` | `0xe6618f9be487ca27ef9ec5d50310363d315a179c09f09c7ca520774b7de93b35` |
| Subscribe `Voided` | id `18392213` | `0x1768418e74f866092b7fd2683184784e91c19ef60c546fd86a5840381c316335` |

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
- Refunds are currently proportional-by-points (exact per-share accounting is a next
  milestone)
- 6-decimal testnet collateral is hardcoded; mainnet 18-decimal config is a next milestone

## License

TBD. This repository is for the Somnia × DreamDEX Event Contracts hackathon — design,
development, and demo.
