# COMMON GROUND — DoraHacks paste

Use this on the BUIDL page. English first. Judges will skim.

## One-liner

Two people who disagree about the future jointly fund a real task. `1 Up + 1 Down = 1 collateral`.

## Problem

DreamDEX Event Contracts are used as a betting terminal: deposit, wait, settle, cash out. People who disagree cannot fund anything together. Research, audits, and maintenance still depend on goodwill after the money moves.

## Solution

COMMON GROUND is a conditional public-action protocol on Somnia × DreamDEX.

1. Complementary Up and Down shares merge into a **deterministic base budget** that pays a real task *before* settlement.
2. A **bonus budget** releases only if the market resolves the pre-agreed way.
3. Delivery is escrowed. The executor commits an artifact; a verifier accepts or rejects; refunds are explicit.
4. Somnia Reactivity advances the plan on `Resolved` / `Voided` — **no off-chain keeper**.

This creates Event Contract volume (`mintSet` of complete sets) for a use case that is not another trading UI.

## Ecosystem impact (the quantified story)

COMMON GROUND turns a disagreement into *multiple* Event Contract actions, not one bet.
Every plan is structurally a volume engine for DreamDEX and a native proof-point for Somnia Reactivity:

1. **One complete-set mint per plan.** To open a plan, contributors mint a full set
   (`1 Up + 1 Down = 1 collateral`). A `100 tUSDC` base budget therefore mints
   `200 tUSDC` of outcome tokens *up front* — before anyone even decides the market.
2. **A conditional bonus held to settlement.** The bonus bucket keeps additional
   outcome tokens on the book until the market resolves, so the plan contributes a
   second, longer-lived position.
3. **A conditional settlement trigger.** The market's `Resolved` / `Voided` event is
   not a keeper script — it is a Somnia Reactivity precompile callback that advances
   the plan on-chain.

Worked example (our demo): `baseBudget = 100 tUSDC` → `100 Up + 100 Down` minted via
`mintSet` (`200 tUSDC` outcome volume), `+50 tUSDC` bonus outcome tokens, then the
market **voided** (uniform `50/50`) and Reactivity settled the plan with **zero
off-chain keeper** — the bonus was skipped and 25 tUSDC returned to the refund pool.

The unit-economics line for judges: **every COMMON GROUND plan = at least
`2 × base + bonus` in Event Contract volume, plus one no-keeper settlement.** N plans
built on N real markets become a repeatable public-goods demand source for DreamDEX,
not a one-off trading UI.

## Live demo (no wallet required)

https://commonground-demo.vercel.app

Completed Shannon testnet run:

- Campaign `0x5dcfe02bc151a8cbf77d2b069e55c6286561dea1`
- Factory `0x63bFD49DbB74A1f731229258fF76495E3b2d8F90`
- Reactivity handler `0xd5dae8eed198aca44f34974c4a2afd45a1d43e37`
- `baseBudget = 100 tUSDC` from merged complementary shares
- Market **voided** (uniform `50/50`) → bonus correctly **Skipped**, 25 tUSDC refunded
- Auto-trigger subscriptions `18413600` (Resolved) and `18413616` (Voided)

Full tx table: [DEPLOYMENT.md](./DEPLOYMENT.md)

## What we used

- DreamDEX Event Contracts + `@somnia-chain/markets-sdk@0.30.0` — discover, `mintSet`, merge, redeem path
- Somnia Reactivity `@somnia-chain/reactivity@0.2.1` — on-chain settlement trigger
- Shannon testnet (`50312`)

## Demo video beats (2:00–2:30)

1. 0:00–0:20 — Hook: “Can two people who disagree fund something together?”
2. 0:20–0:50 — Open the live app. Show the completed run and click two explorer txs. No wallet.
3. 0:50–1:20 — Mechanism: `1 Up + 1 Down = 1 collateral`. Base task starts before settlement.
4. 1:20–1:50 — Settlement: market voided, bonus skipped, Reactivity fired. The void/failure path is a feature.
5. 1:50–2:20 — Addresses + future: permissionless plans, accountable audits, more Event Contract volume.

## Future vision

A public-goods layer on every Event Contract market: audits, research, incident response, and community maintenance funded by people who do not share a forecast. DreamDEX gets volume. Somnia gets a native Reactivity use case that is not a bot.

## Optional extras

- Pitch this file.
- SDK notes: [SDK_FEEDBACK.md](./SDK_FEEDBACK.md)
