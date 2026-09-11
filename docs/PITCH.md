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

## Live demo (no wallet required)

https://commonground-demo.vercel.app

Completed Shannon testnet run:

- Campaign `0xb8d6153b6ca057c3b0f594493058a05f335d3198`
- Factory `0x63bFD49DbB74A1f731229258fF76495E3b2d8F90`
- Reactivity handler `0xd5dae8eed198aca44f34974c4a2afd45a1d43e37`
- `baseBudget = 100 tUSDC` from merged complementary shares
- Market resolved **Down** → bonus correctly **Skipped**
- Auto-trigger subscriptions `18392207` (Resolved) and `18392213` (Voided)

Full tx table: [DEPLOYMENT.md](./DEPLOYMENT.md)

## What we used

- DreamDEX Event Contracts + `@somnia-chain/markets-sdk@0.30.0` — discover, `mintSet`, merge, redeem path
- Somnia Reactivity `@somnia-chain/reactivity@0.2.1` — on-chain settlement trigger
- Shannon testnet (`50312`)

## Demo video beats (2:00–2:30)

1. 0:00–0:20 — Hook: “Can two people who disagree fund something together?”
2. 0:20–0:50 — Open the live app. Show the completed run and click two explorer txs. No wallet.
3. 0:50–1:20 — Mechanism: `1 Up + 1 Down = 1 collateral`. Base task starts before settlement.
4. 1:20–1:50 — Settlement: market went Down, bonus skipped, Reactivity fired. Failure path is a feature.
5. 1:50–2:20 — Addresses + future: permissionless plans, accountable audits, more Event Contract volume.

## Future vision

A public-goods layer on every Event Contract market: audits, research, incident response, and community maintenance funded by people who do not share a forecast. DreamDEX gets volume. Somnia gets a native Reactivity use case that is not a bot.

## Optional extras

- Pitch this file.
- SDK notes: [SDK_FEEDBACK.md](./SDK_FEEDBACK.md)
