# COMMON GROUND — 2:15 Demo Video Script

Target length: **2:00–2:30**. English narration. Record against the live app
(<https://commonground-demo.vercel.app>) with the Somnia block explorer open in a second tab
for the evidence beats.

> Screen-recording tip: keep the wallet and the app side by side. Speak the **Narration**
> lines; the **On-screen** text is either already visible in the UI or an overlay to add in
> editing.

## Scene 1 — Hook (0:00–0:15)

**Narration**
> Two people disagree about the future. One is bullish, one is bearish. Usually that means
> they bet against each other. What if, instead, they used that disagreement to fund real
> work — together?

**On-screen**
- Full-screen COMMON GROUND hero.
- Big overlay: `1 Up + 1 Down = 1 collateral`.

## Scene 2 — The mechanism (0:15–0:45)

**Narration**
> COMMON GROUND is a conditional public-action protocol on Somnia and DreamDEX Event
> Contracts. When a bull and a bear both deposit into the same plan, their complementary
> Up and Down shares merge into deterministic funding. That money pays for a base task no
> matter which way the market goes. A second, bonus bucket is released only if the market
> resolves a pre-agreed way.

**On-screen**
- Show the flow visual: `Up share + Down share → merge → tUSDC`.
- Highlight the two-stage cards: **Unconditional** and **Conditional**.

## Scene 3 — Live app + identity (0:45–1:05)

**Narration**
> Here's the live testnet app. I connect with MetaMask on Somnia Shannon, claim test tUSDC
> from the faucet, and pick a side — I'm bullish, so I fund the Up bucket.

**On-screen (click through)**
1. Connect wallet (MetaMask).
2. `领测试 tUSDC` (faucet).
3. `看涨 ↑ 资助` (fund the Up side, 100 tUSDC).
4. Show balances updating.

## Scene 4 — Two sides become one budget (1:05–1:35)

**Narration**
> The bear contributes the Down side the same way. Once both complementary sides are in,
> anyone can activate the plan. The contract burns the matched set and turns it into a
> deterministic base budget — one hundred tUSDC — locked for the base task.

**On-screen**
- Show the plan list and contributor count.
- Click `合并基础预算` (activate).
- Point at `baseBudget = 100 tUSDC`.

## Scene 5 — Settlement + automatic trigger (1:35–2:00)

**Narration**
> Here's the part that makes it Somnia-native. We don't run a cron job or a keeper to
> advance the plan. We deployed a Reactivity handler and subscribed it to the market's
> Resolved and Voided events. When the market settles, the precompile calls the handler
> on-chain, and the campaign updates itself — no off-chain process, no trusted admin.

**On-screen**
- Open the handler on the explorer:
  `0xd5dae8eed198aca44f34974c4a2afd45a1d43e37`.
- Show the live settlement transaction and final state:
  base budget funded, bonus skipped because the market resolved the other way.

## Scene 6 — Close (2:00–2:15)

**Narration**
> COMMON GROUND turns opposite market positions into funded, authorized, and verifiable
> public action. Full contract addresses, transactions, and tests are in the repo. Built
> for Somnia.

**On-screen**
- GitHub: `github.com/rectinajh/common-ground`.
- Contract addresses: campaign `0xb8d6153b…3198`, factory `0x63bFD49D…8F90`.
- `COMMON GROUND — built for Somnia × DreamDEX`.
