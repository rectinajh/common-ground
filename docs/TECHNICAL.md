# COMMON GROUND — Technical Documentation

## 1. Overview

COMMON GROUND 是一个部署在 Somnia EVM 测试网上的条件式公共行动协议。它使用 DreamDEX Event Contracts 的完整结果份额作为可组合的公共任务资金，并在市场结算前启动确定任务，在市场结算后按条件启动追加任务。

本文件描述架构、模块、数据模型、接口、集成门禁和开发顺序。业务规则以 [COMMON_GROUND_PRD_v1.0.md](./COMMON_GROUND_PRD_v1.0.md) 为准。

## 2. Architecture

```text
Next.js / React 客户端
  计划审阅、贡献、状态、证据、领取
                 |
                 v
CommonGroundCampaign（每计划独立合约）
  不可变计划 + 三桶账本 + 任务托管 + 退出权
                 |
                 v
固定 DreamDEX 适配逻辑 / 官方合约
  查询市场 / 合并完整份额 / 赎回结果权益

链上事件 -> Indexer / Trigger Worker -> 受限推进交易
                         |
                         v
                 独立执行沙箱
                         |
                         v
                  产物存储 / 验收服务
                         |
                         v
                    链上验收与领取
```

## 3. Technology Choices

| Layer | Suggested implementation | Constraint |
|---|---|---|
| Frontend | Next.js, React, TypeScript, wallet connection | No centralized account required; wallet must not auto-switch networks or auto-sign |
| Contracts | Solidity + Foundry | One campaign per plan, non-upgradeable, no arbitrary calls or arbitrary recipients |
| DreamDEX | Locked `markets-sdk` + `viem` | Use SDK for discovery/development; funds must be handled by the vault contract, not team EOA |
| Backend | Node.js / TypeScript | Indexing and allowed transitions only; cannot declare market results |
| Data | PostgreSQL | Projection of on-chain state; not the source of truth |
| Runner | Persistent work queue + isolated runner | Restartable; output bound to one task |
| Artifacts | Public-readable object storage + content digests | Availability not guaranteed forever; cover at least the review and retention period |

## 4. Contract Modules

### CommonGroundCampaign

Each plan is a separate, non-upgradeable campaign contract. It owns:

- immutable `Plan Manifest`;
- three independent buckets: `BASE_UP`, `BASE_DOWN`, `BONUS`;
- task escrow and payment state;
- refund and exit rights.

### Proposed Interfaces

These are project-designed interfaces, not DreamDEX methods.

| Interface | Responsibility |
|---|---|
| `confirmExecutor(planHash)` / `confirmVerifier(planHash)` | Role accepts fixed terms before publication |
| `depositContribution(planHash, bucket, amount)` | Transfer specific tokenId, verify difference, enforce quota and deadline, record bucket |
| `withdrawContribution(bucket, amount)` | Only while original share exit right exists |
| `activateBase()` | Permissionless; check market, deadline, both sides full, one-time merge, actual balance increase, create READY task |
| `failFunding()` | Stop plan and open original asset exit when not activated and expired |
| `syncMarketAndBonus()` | Read official state, redeem once if needed, process bonus condition |
| `startTask(taskIndex)` | Fixed executor, READY state, valid start window |
| `submitEvidence(taskIndex, evidenceHash, uri)` | Fixed executor, single submission, correct task, valid deadline |
| `decideEvidence(taskIndex, evidenceHash, accepted, reasonHash)` | Fixed verifier, current digest, valid deadline |
| `claimTaskPayment(taskIndex)` | Only after ACCEPTED, only to fixed payee |
| `expireTask(taskIndex)` | Permissionless, strictly checks current state and deadline |
| `closeBonus()` | Stop bonus when base failed or decision deadline passed |
| `claimRefund(refundBucket)` | Claim own original share or collateral according to frozen pool |
| `getPlan()` / `getPosition(account)` / `getTask(index)` | Read rules, claimable items, evidence status |

All state changes must happen before external transfers and include reentrancy protection.

## 5. Core Invariants

### Result Share Conservation

For each bucket and tokenId:

```text
registered deposits = unused balance + used in merge + used in redemption + returned original shares
```

`BASE_UP` and `BONUS` must have separate liabilities even when they share the same real `Up` tokenId.

### Collateral Conservation

For every merge/redemption income registered in the plan:

```text
total actual income = task reserve + executor receivable + refund payable + cumulative paid + cumulative refunded
```

`ACCEPTED` converts task reserve to executor receivable. `EXPIRED` converts task reserve to refund payable. The same money must never be in both states.

## 6. State Machines

### Plan Funding State

```text
OPEN -> BASE_ACTIVE -> FINISHED
OPEN -> FUNDING_FAILED -> REFUNDABLE
```

`BASE_ACTIVE` only means base assets have been converted and budget locked. It does not mean the market is settled or the task is complete.

### Official Market State

```text
Listed -> Trading -> Locked -> Resolved / Voided
```

The off-chain database is a projection, not the judge. The adapter must explicitly map official on-chain values.

### Task State

```text
WAITING -> READY -> RUNNING -> SUBMITTED -> ACCEPTED / REJECTED / EXPIRED
```

`SKIPPED` is used when direction, voiding, budget, base failure, or bonus deadline prevents a task.

## 7. Data Model

| Table | Key fields | Constraints |
|---|---|---|
| `plans` | id, chainId, campaignAddress, planHash, marketId, manifest, publishTx | chainId + campaignAddress unique |
| `contributions` | planId, account, bucket, amountRaw, txHash, logIndex | idempotent by event |
| `tasks` | taskId, planId, kind, status, deadlines, evidenceHash, paid | planId + taskIndex unique |
| `runs` | runId, taskId, attempt, inputHash, runnerDigest, timestamps, result | multiple attempts allowed; one formal submission |
| `artifacts` | runId, kind, uri, digest, size, availability | re-verifiable after download |
| `decisions` | taskId, evidenceHash, verifier, decision, reasonHash, txHash | only on-chain final decisions |
| `chain_events` | chainId, blockNumber, blockHash, txHash, logIndex, payload | full audit and reconstruction |
| `worker_cursors` | chainId, contract, lastConfirmedBlock, updatedAt | resumable after outage |

All amounts are decimal strings or big integers. All business deadlines are chain Unix seconds. Display uses UTC and local time; milliseconds/nanoseconds are not treated as plan time.

## 8. HTTP API

Read endpoints:

- `GET /plans`
- `GET /plans/:id`
- `GET /plans/:id/positions/:address`
- `GET /tasks/:id`
- `GET /tasks/:id/evidence`
- `GET /health`

Write endpoints:

- `POST /drafts` saves drafts only.
- `POST /runs/:id/artifacts` receives authorized artifacts.

Off-chain write endpoints must not add balances, mark tasks accepted, or create payment facts. Contract transactions are sent by wallet or a restricted broadcaster.

## 9. Integration Gates

Before full development:

### G0-A

Verify that a wallet's real result shares can be transferred to the campaign contract through a verified approval, and that the contract can merge shares using its own asset and caller identity. Actual collateral must enter the same restricted vault.

### G0-B

Verify that the contract can read the bound market's final state and redeem its own bonus shares. Payment assets must not pass through team personal wallets. Cover win, loss, voided, and wrong-market handling.

### G0-C

Verify that a runner can execute a fixed check template, produce readable reports, and be reviewed by a verifier service independent of executor permissions.

For each gate, save transactions, before/after balances, deployment network, ABI/package versions, and artifacts.

## 10. Deployment and Configuration

Deployment must record:

- target chainId and RPC;
- deployment addresses;
- official module and implementation versions;
- SDK lockfile;
- tokenId and precision;
- planHash;
- task version;
- executor and verifier addresses.

Do not reuse incorrect market cache across plans. Do not copy amount constants between mainnet and testnet without verifying token precision.

## 11. Security Boundaries

- No admin withdrawal or plan upgrade in the base contract.
- Executor sandbox has no private keys, no host write access, no unnecessary external network.
- Frontend and reports must not leak mnemonics, environment variables, or internal tokens.
- Fee-on-transfer and rebasing assets are excluded from v1.
- Direct transfers to the campaign address are not valid contributions; users must call the deposit function.

## 12. Failure Recovery

- Worker stores block cursors and replays logs after disconnection.
- Event uniqueness uses `chainId + txHash + logIndex`.
- Task uniqueness uses `campaignAddress + taskIndex`.
- Processing is at-least-once and idempotent; external side effects need their own idempotency keys.
- If automation is offline, any party may call the same constrained timeout/sync/advance functions.

## 13. Test Checklist

The PRD defines T01–T34. Critical areas:

- wrong network, market, result ID;
- old planHash replay;
- quota, zero amount, address limit;
- direct transfer not counted as funding;
- insufficient base side prevents merge;
- one-time activation and concurrency;
- bonus cannot fill base shortfall;
- verifier cannot approve self;
- accepted task cannot be refunded;
- voided and late-settlement paths;
- refund pool allocation sums exactly;
- worker restart and duplicate logs.

## 14. Roadmap

### P0

- fixed plan, three buckets, base activation, original share exit;
- base task escrow, submission, acceptance, payment;
- bonus branch, voided/failure/expired handling, refund snapshot;
- plan, support, evidence, and exit pages;
- outage recovery and security tests.

### P1

- Somnia on-chain Reactivity;
- multiple executors and verifier sets;
- more task templates;
- authorized automatic issue creation;
- configurable refund weights.

## 15. Development Order

1. G0 integration verification;
2. fixed plan and three-bucket ledger;
3. base one-time activation and original share exit;
4. base task escrow, submission, acceptance, payment;
5. isolated runner;
6. bonus branch, void/fail/expire, refund snapshots;
7. plan and support UI, evidence page, exit page;
8. disconnection recovery, permission, precision, race and security tests;
9. deploy, document, demo, archive evidence.

The P0 scope is narrowed to one plan, one market, one base task, and one conditional bonus. Multi-plan UI, leaderboards, multiple markets, generic arbitration, and on-chain Reactivity are deferred. See `docs/CEO_PLAN.md` for the accepted and cut items.
