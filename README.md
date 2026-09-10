# COMMON GROUND

> 不必相信同一个未来，也能共同完成一件事。
>
> Turn conditional market rights into funded, authorized, verifiable public action.

COMMON GROUND 是一个条件式公共行动产品。参与者将同一 DreamDEX 事件市场的 Up/Down 结果份额交付给一个共同计划：互补份额合并成基础预算，在市场结算前启动真实任务；独立的追加份额只在市场正式结算后，且满足既定方向、预算和交付前提时，才能启动追加任务。

## 项目状态

- 阶段：产品设计与集成验证阶段，尚未实现
- 目标：Somnia × DreamDEX Event Contracts 可运行测试网原型
- 产品名：COMMON GROUND
- 能力名：Common Trigger 是自动触发能力，不是独立产品

## 核心思路

我们不必对未来方向达成一致，但可以提前约定：

1. 哪些事情无论如何都值得做；
2. 哪些事情在特定市场结果出现后追加执行；
3. 资金如何到位；
4. 执行者如何交付；
5. 失败后谁能取回剩余资产。

COMMON GROUND 不把 Event Contracts 当作单纯的下注工具，而是把它作为**条件式公共行动的资金与授权原语**。

## 首版场景

首个真实服务是 **Community Maintenance Check**：

- 基础任务：对预先固定的 repository commit、测试集和运行镜像执行基础回归与权限配置检查；
- 追加任务：对同一代码版本执行另一组预先固定的边界、异常处理或配置检查；
- 交付物：机器可读 JSON、测试日志、人类可读报告和可复现 manifest。

## 核心机制

### 三桶记账

| 资金桶 | 接收资产 | 用途 |
|---|---|---|
| `BASE_UP` | 指定市场 Up | 与 `BASE_DOWN` 等量配对，为基础任务筹资 |
| `BASE_DOWN` | 指定市场 Down | 与 `BASE_UP` 等量配对，为基础任务筹资 |
| `BONUS` | 计划指定的一个方向 | 市场正式结算后有条件资助追加任务 |

### 双阶段行动

- 基础两桶足额后，合并一次完整份额，锁定基础预算，在结算前启动任务；
- 市场正式结算后，只有追加方向获胜、实际可用预算足额、基础任务已验收且仍在决策期限内，才启动追加任务；
- 任何一项不满足，不临时降级任务、不借桶补缺、不把资金交给管理员自由支配。

## 目录结构

```text
apps/web/               计划、贡献、证据、退出界面
apps/worker/            索引、补读、状态推进
apps/verifier/          验收规则与独立签名进程
packages/contracts/     Campaign、受限官方适配、测试
packages/market/        SDK 封装、部署与精度配置
packages/shared/        Manifest、TaskSpec、Artifact schema
runner/                 隔离执行与可复现测试模板
docs/                   架构、部署、证据及开发说明
```

## 文档

- 产品需求文档：[COMMON_GROUND_PRD_v1.0.md](./COMMON_GROUND_PRD_v1.0.md)
- 技术文档：[docs/TECHNICAL.md](./docs/TECHNICAL.md)

## 快速开始

> 代码尚未初始化。开始开发前必须先通过三项集成门禁 `G0-A`、`G0-B`、`G0-C`，详见技术文档和 PRD 第 04 节。

开发顺序建议：

1. 验证 DreamDEX 结果份额转入、合并和赎回；
2. 验证固定执行 runner；
3. 实现 Campaign 合约和三桶账本；
4. 实现基础任务托管、验收和领取；
5. 实现追加分支、作废、失败、过期和退款；
6. 最后实现 Web 界面和证据页。

## 已知限制

- 一个计划绑定一个市场；
- 一个基础任务，至多一个追加任务；
- 最多 32 个贡献地址；
- 首版平台费为 0；
- 不承诺收益，不赔偿市场方向损失；
- 不将不同市场或不同计划的份额混用；
- 不支持仅认捐、不转入资产的承诺。

## License

License 待定。当前仓库仅作为黑客松项目设计、开发和演示使用。
