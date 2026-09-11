# COMMON GROUND — DreamDEX 集成验证记录

Status: ACTIVE (G0 读路径已通过)
SDK: `@somnia-chain/markets-sdk@0.30.0`

本文件记录与 DreamDEX Event Contracts 实测对上的接口、地址与结论。以代码为准，
不要复用旧版 SDK（<=0.28）的 API 形状。

## 1. 网络配置（Shannon 测试网, chainId 50312）

| 项 | 值 |
|---|---|
| markets indexer (HTTP GraphQL) | `https://dev.smk.somnia.host/v1/graphql` |
| chain 定义 | `somniaShannon`（`@somnia-chain/markets-sdk/chains`） |
| WebSocket RPC | `wss://api.infra.testnet.somnia.network/ws` |
| HTTP RPC（备用） | `https://api.infra.testnet.somnia.network` / `https://dream-rpc.somnia.network` |
| 协议地址常量 | `SOMNIA_TESTNET_ADDRESSES` |
| 原生代币 | STT, 18 decimals |

> 生产 indexer 是 `https://prd.smk.somnia.host/v1/graphql`，主网 chainId 是 `5031`。

## 2. 实测对上的关键地址

`exchange.client.getMarketOnchain(marketId)` 实测返回：

| 字段 | 实测值 |
|---|---|
| outcomeToken（ERC-6909 共享单例） | `0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9` |
| collateral（测试网 tUSDC） | `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` |
| collateral decimals | `6` |

结果份额不是每个市场一个 ERC-20，而是共享 ERC-6909 单例上的 `yesId` / `noId`。
`marketId` 是 bytes32，`pool` 会被回收复用，永远用 `marketId` 而不是 `poolAddress` 做键。

## 3. 当前 SDK 核心 API（0.30.0 统一交换面）

```ts
const exchange = new SomniaMarkets({
  indexerUrl, chain: somniaShannon, wsRpcUrl,
  addresses: SOMNIA_TESTNET_ADDRESSES,
  privateKey, // 可选，写操作才需要
});

await exchange.loadMarkets();                 // Record<string, UnifiedMarket>
exchange.markets;                             // symbol -> UnifiedMarket
await exchange.fetchMarkets();                // UnifiedMarket[]

// 读取：无需签名
await exchange.client.getMarketOnchain(marketId);          // MarketOnchain
await exchange.client.getOutcomeBalance({ outcomeToken, account, id });
await exchange.client.listLiveBinaryMarkets(filter);

// 写入：需要签名
await exchange.trader.faucet({ amount });                   // 测试网 tUSDC 水龙头
await exchange.trader.mintSet({ pool, amount });            // 完整份额铸造
await exchange.trader.burnSet({ pool, amount });            // 完整份额烧回抵押资产
await exchange.trader.redeem({ marketId, amount, outcomeIdx }); // 结算后赎回
```

### 统一市场模型

- `UnifiedMarket.info` 是原生 `Market` 联合类型；用 `isBinaryMarket(info)` 收窄到 `BinaryMarket`。
- `BinaryMarket` 关键字段：`marketId`、`yesTokenId`/`noTokenId`、`collateral`、
  `status`（`Listed|Trading|Locked|Settling|Resolved|Voided|Finalized`）、
  `winningOutcome`、`voided`、`expiry`、`tradingStart`、`question`。
- `MarketOnchain.status` 是数字：`0 Listed · 1 Trading · 2 Locked · 3 Settling · 4 Resolved · 5 Voided`。
  写操作必须以链上 `status === 1`（Trading）为门禁，而不是相信 indexer 的派生状态。

## 4. 集成门禁结果

### G0（读路径）— 已通过

- indexer 发现市场：加载 47 个市场，其中 20 个 binary。
- 读取 live `Trading` 市场的链上状态：`status=1`、`decimals=6`、`yesId/noId`、
  `pool`、`collateral`、`outcomeToken` 全部正确返回。
- 结论：市场发现与链上状态读取打通，地址与官方文档一致。

### G0-A（份额铸造 / 合并）— 已通过

`faucet → mintSet → 余额校验 → burnSet` 往返在 Shannon 测试网跑通，余额完全对上：

| 步骤 | 结果 |
|---|---|
| 测试钱包 | `0xB675d67909185f5E983EC51b2AED14667eA31b33` |
| faucet | mint 10000 tUSDC，余额 `500000000 → 10500000000` |
| mintSet | 100 tUSDC → 100 Up + 100 Down（各 `100000000`） |
| burnSet | 完整份额烧回，余额回到 `10500000000` |

结论：ERC-6909 结果份额铸造与合并路径打通；`mintSet`/`burnSet` 是合约 `mergeCompleteSet`
的等价原语，G0-A 与合并路径已验证。

### G0-B（结算后赎回）— 待一个结算市场

`redeem` 需要等一个市场结算（win/loss/void 三种路径），当前只能在一个窗口结束后验证。
合约侧逻辑已实现（`syncMarketAndBonus`），待结算窗口出现后补上链上证据。

复现命令（已支持 `.env` 自动加载）：

```bash
cp packages/market/.env.example packages/market/.env  # 填入私钥
npm run spike:market -- --write
```

写操作只在 `status === 1`（Trading）的市场可用；`redeem` 在 `Resolved`/`Voided` 后可用，
作废市场需要按 `outcomeIdx` 分别赎回。

### G0-C（执行器）— 待实现

固定检查模板 + 隔离 runner + 独立验收，与链上托管解耦。

## 5. 复现命令

```bash
npm install
npm run spike:market          # 只读验证：发现市场 + 读链上状态
```

开发时先 `npm run build --workspace @common-ground/market`，脚本输出到
`packages/market/dist/`。运行脚本是纯 Node，避免 `tsx` 在本机沙箱的 IPC 限制。
