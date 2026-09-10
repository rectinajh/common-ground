# COMMON GROUND — Contracts

Foundry (Solidity `^0.8.24`, `evm_version = "cancun"`). One non-upgradeable
`CommonGroundCampaign` per plan.

## Build & test

```bash
forge build
forge test -vv
```

## Files

| Path | Purpose |
|---|---|
| `src/CommonGroundCampaign.sol` | three-bucket ledger, merge, task escrow, payment, refund |
| `src/interfaces/IDreamDEX.sol` | raw DreamDEX ABI (module merge/redeem, ERC-6909, ERC-20) |
| `test/CommonGroundCampaign.t.sol` | happy path + base-reject refund |
| `test/mocks/MockDreamDEX.sol` | mock outcome token / collateral / module / market / pool |

## Integration notes

- The campaign calls `IBinaryMarketsModule.mergeCompleteSet` (base budget) and
  `redeem` (bonus settlement) directly, keyed by immutable `operatorId` / `venueId` /
  `marketId` frozen at deploy.
- `operatorId` and `venueId` come from the market's `MarketCreated` config and are NOT
  readable from `getBinaryPoolParams()` — capture them at deploy.
- Contributors must `setOperator(campaign, true)` on the ERC-6909 singleton before
  `deposit`, because shares move by operator-based `transferFrom`, not ERC-20 approve.
- `forge-std` is vendored under `lib/forge-std`. To pin a fresh copy:
  `forge install foundry-rs/forge-std`.

See `docs/TECHNICAL.md` §16 for the locked architecture and P0 test scope.
