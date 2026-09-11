# COMMON GROUND — Worker (keeper)

Off-chain keeper that advances a `CommonGroundCampaign` by calling its
**permissionless** state-transition functions only. It never holds a key that can
move funds off-plan, and it never declares a market result — the campaign reads
authoritative on-chain state itself.

## Run

```bash
cp .env.example .env   # set CAMPAIGN_ADDRESS and PRIVATE_KEY
npm run once           # single pass
npm run start          # watch loop (poll every 15s)
```

## Decisions it makes

| Observed state | Action |
|---|---|
| `planState == BaseActive` and market settled | `syncMarketAndBonus()` |
| `planState == Open` and market settled | `failFunding()` |
| task `Ready`/`Running` and decision deadline passed | `expireTask(taskIndex)` |

Gas is pinned to `maxFeePerGas=60 gwei` (Somnia base fee can spike) and every tx is
idempotent-safe: re-running after a success observes the new state and does nothing.
