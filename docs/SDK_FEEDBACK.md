# DreamDEX / Somnia SDK feedback

Optional hackathon artifact. Written from a live Shannon integration
(`@somnia-chain/markets-sdk@0.30.0`, `@somnia-chain/reactivity@0.2.1`).

## What worked

- `SomniaMarkets.loadMarkets()` + `client.getMarketOnchain(marketId)` is enough to bind a
  campaign to a live binary market (pool, collateral, yes/no token ids, status).
- `trader.mintSet` / `burnSet` are the complete-set primitives the product needs.
  `1 Up + 1 Down = 1 collateral` is not a metaphor — it is `mergeCompleteSet`.
- Shared ERC-6909 outcome token is the right model. Keying by `marketId`, never by a
  recycled `pool` address, saved us a class of bugs.
- Reactivity handler convention (`onEvent` only from precompile `0x0100`) is clean.
  A registry handler can fan out `Resolved` / `Voided` to many campaigns.

## What hurt

1. **Gas estimation on Shannon is ~15× too low for first-time deploys.**
   A local 3.4M estimate needed ~52M on-chain. Without
   `--gas-estimate-multiplier 2000` the deploy dies as status 0. Docs should say this
   on the first “hello world” page.

2. **EIP-1559 base fee spikes above the wallet default.**
   Consecutive writes fail with `gas price < basefee` unless `maxFeePerGas` is pinned
   (we use 60 gwei). A helper in the SDK (`suggestFees()`) would cut a day of debugging.

3. **Indexer status lags the chain.**
   UI that trusts `UnifiedMarket.status` will offer `mintSet` on a market that is already
   `Locked`. The only safe gate is on-chain `status === 1`. Call this out in the Event
   Contracts quickstart.

4. **Windows are short.**
   A demo that discovers a market, deploys, and mints can lose `Trading` mid-script.
   A `listLiveBinaryMarkets({ minTtlSec: 300 })` filter (or documented equivalent)
   would make hackathon demos less brittle.

5. **Reactivity subscription ownership is easy to underfund.**
   The owner must keep ≥ 32 STT. That constraint belongs next to the subscribe example,
   not only in the precompile spec.

6. **Docs still drift from SDK 0.30.**
   Older examples (≤0.28) use a different exchange surface. A “do not copy from blogs
   dated before 0.30” banner would have saved us a wrong ABI afternoon.

## Ask

A one-page “Event Contracts for products that are not a trading terminal” would help
the next team. mint / merge / redeem are enough to fund real work. That is a bigger
adoption surface than another PnL chart.
