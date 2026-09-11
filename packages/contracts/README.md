# COMMON GROUND — Contracts

Foundry (Solidity `^0.8.24`, `evm_version = "cancun"`). One non-upgradeable
`CommonGroundCampaign` per plan.

## Build & test

```bash
forge build
forge test -vv
```

## Deploy (Shannon testnet)

```bash
PK=$(grep '^DREAMDEX_PRIVATE_KEY=' ../market/.env | cut -d= -f2)
forge script script/DeployCampaign.s.sol \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key "$PK" --broadcast --gas-estimate-multiplier 2000
```

> **Somnia gas gotcha:** a ~12KB contract deploy costs ~52M gas on Somnia (~15x the
> 3.4M local estimate). Without `--gas-estimate-multiplier 2000` the tx reverts with
> status 0 because the default estimate becomes the gas limit.

Live P0 deployment (Shannon 50312):

- Campaign: `0xe53e5d8945d6c4b771f6eb9add448967d35a8ee9`
- Deploy tx: `0x7d48e9422af49ec9bbb64d13a0f995664f9a8c82ce955a83da1caaa5d3068e68`

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
