import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseAbi,
  webSocket,
  type Address,
} from "viem";
import {
  CHAIN,
  DEMO_CAMPAIGN,
  STT_FAUCET_URL,
  T_USDC,
  UNIT,
  WS_RPC,
  campaignAbi,
  collateralAbi,
  outcomeTokenAbi,
  poolAbi,
} from "./config";

const publicClient = createPublicClient({ chain: CHAIN, transport: http() });
const marketAbi = parseAbi([
  "function isResolved() view returns (bool)",
  "function isVoided() view returns (bool)",
]);

const PLAN_LABELS = ["待启动", "基础已激活", "已完成", "募资失败", "可退款"];
const TASK_LABELS = ["等待", "就绪", "执行中", "已交付", "已验收", "已驳回", "已过期", "已跳过"];

const fmt = (v: bigint) => (Number(v) / 1e6).toFixed(2);
const fmtEth = (v: bigint) => (Number(v) / 1e18).toFixed(4);
const shortHash = (h: string) => (h.length > 18 ? `${h.slice(0, 18)}…` : h);
const ZERO_HASH = `0x${"0".repeat(64)}`;

type TaskStruct = {
  state: number;
  evidenceHash: `0x${string}`;
  evidenceUri: string;
  startDeadline: bigint;
  decisionDeadline: bigint;
  budget: bigint;
};

type CampaignView = {
  planState: number;
  baseBudget: bigint;
  bonusBudget: bigint;
  totalBaseUp: bigint;
  totalBaseDown: bigint;
  totalBonus: bigint;
  contributorCount: bigint;
  mergedAmount: bigint;
  baseTask: TaskStruct;
  bonusTask: TaskStruct;
  market: Address;
  collateral: Address;
  pool: Address;
  outcomeToken: Address;
  settled: boolean;
};

function useCampaign(campaign: Address): {
  view: CampaignView | null;
  live: boolean;
  loading: boolean;
  reload: () => void;
} {
  const [view, setView] = useState<CampaignView | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
    const read = (functionName: string, args?: readonly unknown[]) =>
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName, args } as never);

    const [
      planState, baseBudget, bonusBudget, totalBaseUp, totalBaseDown, totalBonus,
      contributorCount, mergedAmount, baseTask, bonusTask, market, collateral, pool, outcomeToken,
    ] = await Promise.all([
      read("planState"), read("baseBudget"), read("bonusBudget"),
      read("totalBaseUp"), read("totalBaseDown"), read("totalBonus"),
      read("contributorCount"), read("mergedAmount"),
      read("getTask", [0n]), read("getTask", [1n]),
      read("market"), read("collateralToken"), read("pool"), read("outcomeToken"),
    ]);

    const [resolved, voided] = await Promise.all([
      publicClient.readContract({ address: market as Address, abi: marketAbi, functionName: "isResolved" }),
      publicClient.readContract({ address: market as Address, abi: marketAbi, functionName: "isVoided" }),
    ]);

    setView({
      planState: planState as number,
      baseBudget: baseBudget as bigint,
      bonusBudget: bonusBudget as bigint,
      totalBaseUp: totalBaseUp as bigint,
      totalBaseDown: totalBaseDown as bigint,
      totalBonus: totalBonus as bigint,
      contributorCount: contributorCount as bigint,
      mergedAmount: mergedAmount as bigint,
      baseTask: baseTask as TaskStruct,
      bonusTask: bonusTask as TaskStruct,
      market: market as Address,
      collateral: collateral as Address,
      pool: pool as Address,
      outcomeToken: outcomeToken as Address,
      settled: Boolean(resolved) || Boolean(voided),
    });
    } catch {
      // Keep the last known view; the next poll will retry.
    } finally {
      setLoading(false);
    }
  }, [campaign]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    let unsub: (() => void) | undefined;
    let last = 0;
    try {
      const wsClient = createPublicClient({ chain: CHAIN, transport: webSocket(WS_RPC) });
      unsub = wsClient.watchBlockNumber({
        onBlockNumber: () => {
          setLive(true);
          const now = Date.now();
          if (now - last > 3000) {
            last = now;
            load();
          }
        },
        onError: () => setLive(false),
      });
    } catch {
      setLive(false);
    }
    return () => {
      clearInterval(id);
      unsub?.();
    };
  }, [load]);

  return { view, live, loading, reload: load };
}

function FlowVisual({ baseBudget }: { baseBudget: bigint }) {
  return (
    <div className="flow">
      <div className="flowPair">
        <div className="chip up"><span>↑</span>看涨仓位</div>
        <div className="plus">+</div>
        <div className="chip down"><span>↓</span>看跌仓位</div>
      </div>
      <div className="wire" />
      <div className="chip merge">合并</div>
      <div className="wire" />
      <div className="chip fund"><span>◎</span>{fmt(baseBudget)} tUSDC</div>
    </div>
  );
}

function App() {
  const [campaign, setCampaign] = useState<Address>(DEMO_CAMPAIGN as Address);
  const [account, setAccount] = useState<Address | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ stt: bigint; tUsdc: bigint } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"info" | "ok" | "err">("info");
  const { view, live, loading, reload } = useCampaign(campaign);

  const walletClient = useMemo(
    () =>
      account
        ? createWalletClient({ chain: CHAIN, transport: custom((window as any).ethereum), account })
        : null,
    [account],
  );

  const FEES = { maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n };

  const notify = (text: string, type: "info" | "ok" | "err" = "info") => {
    setMsg(text);
    setMsgType(type);
  };

  const friendlyError = (e: unknown): string => {
    const m = e instanceof Error ? e.message : String(e);
    if (/user rejected|user denied|denied message signature|4001/i.test(m)) return "已在钱包中取消";
    if (/insufficient funds|gas required exceeds allowance/i.test(m)) return "余额不足：需要更多 STT 作为 gas";
    if (/nonce too low|nonce too high/i.test(m)) return "交易序号冲突，请稍候重试";
    if (/tradingnotactive/i.test(m)) return "市场已不在交易阶段，无法执行该操作";
    if (/faucetcapexceeded/i.test(m)) return "测试币水龙头已达本次上限";
    if (/wrong network|chain mismatch/i.test(m)) return "请切换到 Somnia Testnet（chainId 50312）";
    return m.length > 160 ? `${m.slice(0, 160)}…` : m;
  };

  const connect = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return notify("请安装 MetaMask", "err");
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xC488" }] }).catch(
      () => eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0xC488",
          chainName: "Somnia Testnet",
          rpcUrls: ["https://dream-rpc.somnia.network"],
          nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
          blockExplorerUrls: ["https://shannon-explorer.somnia.network"],
        }],
      }),
    );
    const [addr] = await eth.request({ method: "eth_requestAccounts" });
    setAccount(addr as Address);
    const [stt, tUsdc] = await Promise.all([
      publicClient.getBalance({ address: addr as Address }),
      publicClient.readContract({ address: T_USDC, abi: collateralAbi, functionName: "balanceOf", args: [addr as Address] }),
    ]);
    setBalances({ stt, tUsdc });
    setMsg(null);
  };

  const signIn = async () => {
    if (!account) return;
    const eth = (window as any).ethereum;
    try {
      const sig = await eth.request({
        method: "personal_sign",
        params: [`Sign in to COMMON GROUND\n${account}\n${Date.now()}`, account],
      });
      setSignature(sig as string);
      notify("签名验证成功", "ok");
    } catch (e) {
      notify(`签名失败: ${friendlyError(e)}`, "err");
    }
  };

  const refreshBalance = async () => {
    if (!account) return;
    const [stt, tUsdc] = await Promise.all([
      publicClient.getBalance({ address: account }),
      publicClient.readContract({ address: T_USDC, abi: collateralAbi, functionName: "balanceOf", args: [account] }),
    ]);
    setBalances({ stt, tUsdc });
  };

  const faucet = async () => {
    if (!walletClient || !account) return;
    setBusy("faucet");
    setStep("领取测试币…");
    setMsg(null);
    try {
      const hash = await walletClient.writeContract({
        address: T_USDC,
        abi: collateralAbi,
        functionName: "faucet",
        args: [10000n * UNIT],
        ...FEES,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshBalance();
      notify("已领取 10,000 tUSDC", "ok");
    } catch (e) {
      notify(`领取失败: ${friendlyError(e)}`, "err");
    } finally {
      setBusy(null);
      setStep(null);
    }
  };

  const fund = async (kind: "base" | "bonus") => {
    if (!walletClient || !view || !account) return;
    const amount = (kind === "base" ? 100n : 50n) * UNIT;
    setBusy(kind);
    setMsg(null);
    try {
      const send = async (label: string, call: () => Promise<`0x${string}`>) => {
        setStep(label);
        const hash = await call();
        await publicClient.waitForTransactionReceipt({ hash });
      };

      await send("授权抵押品…", () =>
        walletClient.writeContract({ address: view.collateral, abi: collateralAbi, functionName: "approve", args: [view.pool, amount], ...FEES }));
      await send("铸造 Up + Down 份额…", () =>
        walletClient.writeContract({ address: view.pool, abi: poolAbi, functionName: "mintSet", args: [account, account, amount], ...FEES }));
      await send("授权金库…", () =>
        walletClient.writeContract({ address: view.outcomeToken, abi: outcomeTokenAbi, functionName: "setOperator", args: [campaign, true], ...FEES }));

      if (kind === "base") {
        await send("交付看涨份额…", () =>
          walletClient.writeContract({ address: campaign, abi: campaignAbi, functionName: "deposit", args: [0, amount], ...FEES }));
        await send("交付看跌份额…", () =>
          walletClient.writeContract({ address: campaign, abi: campaignAbi, functionName: "deposit", args: [1, amount], ...FEES }));
      } else {
        await send("交付追加份额…", () =>
          walletClient.writeContract({ address: campaign, abi: campaignAbi, functionName: "deposit", args: [2, amount], ...FEES }));
      }

      setStep("完成");
      notify(kind === "base" ? "已资助基础任务 100 tUSDC" : "已资助追加任务 50 tUSDC", "ok");
      await refreshBalance();
      reload();
    } catch (e) {
      notify(`失败: ${friendlyError(e)}`, "err");
    } finally {
      setBusy(null);
      setTimeout(() => setStep(null), 1500);
    }
  };

  const activate = async () => {
    if (!walletClient) return;
    setBusy("activate");
    setStep("合并互补份额…");
    try {
      const h = await walletClient.writeContract({ address: campaign, abi: campaignAbi, functionName: "activateBase", ...FEES });
      await publicClient.waitForTransactionReceipt({ hash: h });
      notify("基础预算已合并锁定", "ok");
      reload();
    } catch (e) {
      notify(`失败: ${friendlyError(e)}`, "err");
    } finally {
      setBusy(null);
      setStep(null);
    }
  };

  const ready = !!account && !!signature;

  return (
    <div className="app">
      <div className="bg" />

      <header className="topbar">
        <div className="brand">
          <span className="mark">◎</span>
          <span>COMMON GROUND</span>
          <span className={`live ${live ? "on" : ""}`} title={live ? "实时事件流已连接" : "轮询中（实时流未连接）"}>
            <i />{live ? "LIVE" : "POLL"}
          </span>
        </div>
        <div className="wallet">
          {!account ? (
            <button className="btn ghost" onClick={connect}>连接钱包</button>
          ) : (
            <>
              <span className="addr">{account.slice(0, 6)}…{account.slice(-4)}</span>
              {signature ? <span className="ok">✓ 已验证</span> : <button className="btn" onClick={signIn}>签名验证</button>}
            </>
          )}
        </div>
      </header>

      {account && balances && (
        <div className="balanceLine">
          <span>{fmtEth(balances.stt)} STT</span>
          <span className="dot">·</span>
          <span>{fmt(balances.tUsdc)} tUSDC</span>
          <span className="spacer" />
          <button className="mini" disabled={!!busy} onClick={faucet}>
            {busy === "faucet" ? step ?? "领取中…" : "领测试 tUSDC"}
          </button>
          <a className="mini link" href={STT_FAUCET_URL} target="_blank" rel="noreferrer">领 STT ↗</a>
        </div>
      )}

      <section className="hero">
        <h1>
          不必对未来达成一致，
          <br />
          <span className="grad">也能共同完成一件事。</span>
        </h1>
        <p className="sub">
          <code>1 Up + 1 Down = 1 抵押品</code>。两个判断相反的人，把对赌变成共同出资：
          配对部分无条件资助基础任务，市场结果只决定要不要追加执行。
        </p>
        {loading && !view && <p className="loadingHint">正在读取链上状态…</p>}
        {view && <FlowVisual baseBudget={view.baseBudget} />}
      </section>

      <section className="stats">
        <div className="stat">
          <span className="k">计划状态</span>
          <b>{view ? PLAN_LABELS[view.planState] : "—"}</b>
        </div>
        <div className="stat">
          <span className="k">基础预算</span>
          <b className="c1">{view ? fmt(view.baseBudget) : "—"}<small> tUSDC</small></b>
        </div>
        <div className="stat">
          <span className="k">追加预算</span>
          <b className="c2">{view ? fmt(view.bonusBudget) : "—"}<small> tUSDC</small></b>
        </div>
        <div className="stat">
          <span className="k">贡献者</span>
          <b>{view ? view.contributorCount.toString() : "—"}</b>
        </div>
      </section>

      <section className="tasks">
        <article className="card base">
          <div className="cardHead">
            <span className="badge base">无条件</span>
            <span className={`state s${view?.baseTask.state ?? 0}`}>{view ? TASK_LABELS[view.baseTask.state] : "—"}</span>
          </div>
          <h2>基础任务 · 无论如何都做</h2>
          <p>对固定 commit 执行基础回归与权限检查。资金来自互补份额合并，不依赖市场方向。</p>
          {view && view.baseTask.evidenceHash !== ZERO_HASH && (
            <div className="evidence">
              <span>交付证据</span>
              <code title={view.baseTask.evidenceUri}>
                {shortHash(view.baseTask.evidenceHash)}
                {view.baseTask.evidenceUri ? ` · ${view.baseTask.evidenceUri.slice(0, 40)}` : ""}
              </code>
            </div>
          )}
          <div className="cardFoot">
            <span>预算 <b>{view ? fmt(view.baseTask.budget) : "—"} tUSDC</b></span>
            <button className="btn" disabled={!ready || !!busy} onClick={() => fund("base")}>
              {busy === "base" ? step ?? "处理中…" : "资助 100 tUSDC"}
            </button>
          </div>
        </article>

        <article className="card bonus">
          <div className="cardHead">
            <span className="badge bonus">有条件</span>
            <span className={`state s${view?.bonusTask.state ?? 0}`}>{view ? TASK_LABELS[view.bonusTask.state] : "—"}</span>
          </div>
          <h2>追加任务 · 结算后才触发</h2>
          <p>仅当市场结果为 Up 时，才对同一 commit 追加边界 / 异常检查。条件不满足即跳过，资金不浪费。</p>
          {view && view.bonusTask.evidenceHash !== ZERO_HASH && (
            <div className="evidence">
              <span>交付证据</span>
              <code title={view.bonusTask.evidenceUri}>
                {shortHash(view.bonusTask.evidenceHash)}
                {view.bonusTask.evidenceUri ? ` · ${view.bonusTask.evidenceUri.slice(0, 40)}` : ""}
              </code>
            </div>
          )}
          <div className="cardFoot">
            <span>预算 <b>{view ? fmt(view.bonusTask.budget) : "—"} tUSDC</b></span>
            <button className="btn amber" disabled={!ready || !!busy} onClick={() => fund("bonus")}>
              {busy === "bonus" ? step ?? "处理中…" : "资助 50 tUSDC"}
            </button>
          </div>
        </article>
      </section>

      <section className="bar">
        <div className="barLeft">
          <span className="k">计划合约</span>
          <input value={campaign} onChange={(e) => setCampaign(e.target.value as Address)} spellCheck={false} />
        </div>
        <div className="barRight">
          {view?.settled && <span className="settled">市场已结算</span>}
          <button className="btn ghost" disabled={!ready || !!busy} onClick={activate}>
            {busy === "activate" ? step ?? "合并中…" : "合并基础预算"}
          </button>
        </div>
      </section>

      {msg && <div className={`toast ${msgType}`}>{msg}</div>}
    </div>
  );
}

export default App;
