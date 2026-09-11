# COMMON GROUND — Web

Single-page dashboard for one `CommonGroundCampaign`. Hides Up/Down mechanics and
frames the product as "fund a mission": an unconditional base task plus a conditional
bonus task.

## Run

```bash
npm run dev       # http://localhost:5173
npm run build
```

Connect MetaMask on Somnia Testnet (chainId 50312). The default campaign address is in
`src/config.ts` (`DEMO_CAMPAIGN`); it can be overridden in the UI input.

## Actions

- **资助基础任务** — mints a complete set and deposits both Up and Down (deterministic).
- **资助追加任务（押涨）** — mints a complete set and deposits the Up side for the bonus.
- **合并基础预算** — calls the permissionless `activateBase`.

The wallet needs test STT (gas) and tUSDC (collateral). See `docs/INTEGRATION.md` for
faucet links.
