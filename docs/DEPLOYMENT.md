# COMMON GROUND — Deployment Evidence

Chain: Somnia Shannon Testnet (chainId `50312`)
Wallet: `0xB675d67909185f5E983EC51b2AED14667eA31b33`
SDK: `@somnia-chain/markets-sdk@0.30.0`
Contracts: `packages/contracts`

## 1. Contract deployments

| Purpose | Address | Tx |
|---|---|---|
| Campaign (forge deploy, gas-gotcha verified) | `0xe53e5d8945d6c4b771f6eb9add448967d35a8ee9` | `0x7d48e9422af49ec9bbb64d13a0f995664f9a8c82ce955a83da1caaa5d3068e68` |
| **Campaign (final end-to-end demo)** | **`0xb8d6153b6ca057c3b0f594493058a05f335d3198`** | `0xd431002eab001709a6cbbceb49ce534371f73394c077e2ed16ff8673425cd5a9` |

## 2. End-to-end demo (final campaign)

Bound market: `0x0000000000000000000000000000000000000000000000000000000000019b12`
(expiry `1789095600`, resolved to Down)

| Step | Tx |
|---|---|
| deploy campaign | `0xd431002eab001709a6cbbceb49ce534371f73394c077e2ed16ff8673425cd5a9` |
| mint complete set (150 tUSDC) | `0xd2cd66550abe5befe127d1aee0553281989749e92cb3c5cdfa8aa3ca42071f0d` |
| setOperator (ERC-6909) | `0x115f23d2d402aa869bee99e08b8ee3f077ff88fedbb5a4e7986be9cb71c8466f` |
| deposit 100 Up (BASE_UP) | `0x0ff65aaaed82455d748b863e23f25dffb8b83d6f554f3d09b57fd5865afe2848` |
| deposit 100 Down (BASE_DOWN) | `0x19410c46748379dced0223d4115a054e2dfd38ae45995ccbb2b81fb210fa5440` |
| deposit 50 Up (BONUS) | `0xec7e86985ff48bd471b0d210e0d63cd3b74220764f1c6014ef813b4c9b6f53cd` |
| activateBase (merge) | `0x454119d783de1b77594dbb7ecdb1d67a621899e59232663cd8819f8de856ba0e` |
| syncMarketAndBonus (settlement) | `0x232df62a9d3226aea7fbf0a83ab5fcb247b3c4ec1ebc284678138fbf817db73b` |

### Final on-chain state

| Field | Value | Meaning |
|---|---|---|
| `planState` | `1` | BaseActive |
| `baseBudget` | `100000000` (100 tUSDC) | deterministic base budget from merged complementary shares |
| `baseTask.state` | `1` | Ready |
| `bonusBudget` | `0` | Up lost → bonus correctly not funded |
| `bonusTask.state` | `7` | Skipped |

## 3. G0 integration gates

| Gate | Result | Evidence |
|---|---|---|
| G0 (read) | PASS | 47 markets / 20 binary discovered; `getMarketOnchain` returned correct `status=1`, ids, collateral |
| G0-A (mint/merge) | PASS | faucet 10000 tUSDC → `mintSet` 100 tUSDC = 100 Up + 100 Down → `burnSet` reconciled to the cent |
| G0-B (redeem) | PASS | `syncMarketAndBonus` after settlement redeemed/skipped bonus per on-chain outcome |

## 4. Tests

`forge test`: **7/7 passing** — base happy path, base reject refund, bonus win/loss/void,
task expiry, funding fail.

## 5. Known Somnia gotchas (why these matter for the submission)

1. Deploys cost ~15x the local estimate (~52M gas) — need `--gas-estimate-multiplier 2000`.
2. EIP-1559 base fee can spike above the default estimate — pin `maxFeePerGas=60 gwei`.
3. Consecutive writes need explicit nonce management.
4. Writes must target a market still in `Trading` state (`TradingNotActive` otherwise).
