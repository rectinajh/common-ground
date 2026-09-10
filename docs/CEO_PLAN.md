# COMMON GROUND — CEO Plan & Hackathon Scope Decisions

Status: ACTIVE
Generated: 2026-09-11
Mode: SELECTIVE EXPANSION

## Verdict

The full COMMON GROUND protocol is a strong long-term vision but too broad for a hackathon submission. The winning move is to keep one clear wedge, validate the DreamDEX integration gates first, and add two memorable demo moments.

## Positioning

Primary sentence:

> You don't have to agree on the future to make something happen.

COMMON GROUND is not a prediction market tool. It is a conditional public action protocol that turns complementary event interests into funded, authorized, verifiable tasks.

## Scope Decisions

### Keep in P0

- One plan, one DreamDEX market.
- One base task and one conditional bonus task.
- Three explicit buckets: `BASE_UP`, `BASE_DOWN`, `BONUS`.
- Real share deposit, merge, market observation, redemption, acceptance, payment, and failure refund.
- One clean task detail page.

### Cut from P0

- Multi-plan creator.
- Leaderboards, animations, and complex social features.
- Multiple markets and multiple bonus tasks.
- Generic dispute arbitration.
- Somnia on-chain Reactivity.

### Two wow points to add

1. After settlement, automatically mint a `Resolved: Up/Down` credential or release the next budget. This shows the market result produced a real action.
2. Demo one failure path: verifier rejects delivery, funds return to contributors. Failure recovery makes the happy path more credible.

## Ranking Levers

| Official criteria | Action | Expected effect |
|---|---|---|
| Innovation 20% | Position as conditional public action, not betting | High |
| Technical 25% | Pass G0-A/B/C before UI work | Decisive |
| UX 20% | Hide Up/Down merge; show "fund a mission" | Strong lift |
| Business 20% | Use a real maintenance/audit task | Concrete |
| Presentation 15% | Open with the counterintuitive moment | High |

## Demo Script

1. Alice believes Up, Bob believes Down.
2. Both contribute opposite shares to the same mission.
3. The contract merges matched shares into deterministic base budget.
4. The base task runs before settlement.
5. The market settles, then the conditional bonus executes.
6. Close with: "You don't have to agree on the future to make something happen."

## Development Order

1. G0 integration verification.
2. Fixed campaign and three-bucket ledger.
3. Base activation and original share exit.
4. Base task escrow, submission, acceptance, payment.
5. Isolated runner.
6. Bonus branch, void/fail/expire, refund snapshots.
7. Plan and evidence UI.
8. Outage recovery, permissions, precision, race and security tests.
9. Deploy, document, demo, archive evidence.
