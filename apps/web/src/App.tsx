import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
} from "viem";
import {
  CHAIN,
  DEMO_CAMPAIGN,
  T_USDC,
  UNIT,
  campaignAbi,
  collateralAbi,
  outcomeTokenAbi,
  poolAbi,
} from "./config";

const publicClient = createPublicClient({ chain: CHAIN, transport: http() });

const PLAN_LABELS = ["Open", "BaseActive", "Finished", "FundingFailed", "Refundable"];
const TASK_LABELS = ["Waiting", "Ready", "Running", "Submitted", "Accepted", "Rejected", "Expired", "Skipped"];

type CampaignView = {
  planState: number;
  baseBudget: bigint;
  bonusBudget: bigint;
  totalBaseUp: bigint;
  totalBaseDown: bigint;
  totalBonus: bigint;
  baseTask: readonly [number, `0x${string}`, string, bigint, bigint, bigint];
  bonusTask: readonly [number, `0x${string}`, string, bigint, bigint, bigint];
  collateral: Address;
  pool: Address;
  outcomeToken: Address;
};

const fmt = (v: bigint) => (Number(v) / 1e6).toFixed(2);
const fmtEth = (v: bigint) => (Number(v) / 1e18).toFixed(4);

function useCampaign(campaign: Address): CampaignView | null {
  const [view, setView] = useState<CampaignView | null>(null);

  const load = useCallback(async () => {
    const [
      planState,
      baseBudget,
      bonusBudget,
      totalBaseUp,
      totalBaseDown,
      totalBonus,
      baseTask,
      bonusTask,
      collateral,
      pool,
      outcomeToken,
    ] = await Promise.all([
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "planState" }),
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "baseBudget" }),
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "bonusBudget" }),
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "totalBaseUp" }),
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "totalBaseDown" }),
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "totalBonus" }),
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "getTask", args: [0n] }),
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "getTask", args: [1n] }),
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "collateralToken" }),
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "pool" }),
      publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "outcomeToken" }),
    ]);
    setView({
      planState: planState as number,
      baseBudget: baseBudget as bigint,
      bonusBudget: bonusBudget as bigint,
      totalBaseUp: totalBaseUp as bigint,
      totalBaseDown: totalBaseDown as bigint,
      totalBonus: totalBonus as bigint,
      baseTask: baseTask as CampaignView["baseTask"],
      bonusTask: bonusTask as CampaignView["bonusTask"],
      collateral: collateral as Address,
      pool: pool as Address,
      outcomeToken: outcomeToken as Address,
    });
  }, [campaign]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  return view;
}

function App() {
  const [campaign, setCampaign] = useState<Address>(DEMO_CAMPAIGN as Address);
  const [account, setAccount] = useState<Address | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ stt: bigint; tUsdc: bigint } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const view = useCampaign(campaign);

  const walletClient = useMemo(
    () =>
      account
        ? createWalletClient({ chain: CHAIN, transport: custom((window as any).ethereum), account })
        : null,
    [account],
  );

  const connect = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return setMsg("请安装 MetaMask");
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

    // Load balances: STT (gas) + tUSDC (collateral).
    const [stt, tUsdc] = await Promise.all([
      publicClient.getBalance({ address: addr as Address }),
      publicClient.readContract({
        address: T_USDC,
        abi: collateralAbi,
        functionName: "balanceOf",
        args: [addr as Address],
      }),
    ]);
    setBalances({ stt, tUsdc });
    setMsg(null);
  };

  // Separate from connect: signing is opt-in, so a plain connect is not a
  // phishing-shaped "connect then immediately sign" pattern.
  const signIn = async () => {
    if (!account) return;
    const eth = (window as any).ethereum;
    try {
      const signText = `Sign in to COMMON GROUND\n${account}\n${Date.now()}`;
      const sig = await eth.request({ method: "personal_sign", params: [signText, account] });
      setSignature(sig as string);
      setMsg("签名验证成功");
    } catch (e) {
      setMsg(`签名已取消: ${(e as Error).message}`);
    }
  };

  const fundBase = async () => {
    if (!walletClient || !view) return;
    setBusy("fund-base");
    setMsg(null);
    try {
      const amount = 100n * UNIT;
      const h1 = await walletClient.writeContract({
        address: view.collateral,
        abi: collateralAbi,
        functionName: "approve",
        args: [view.pool, amount],
        maxFeePerGas: 60_000_000_000n,
        maxPriorityFeePerGas: 2_000_000_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: h1 });

      const h2 = await walletClient.writeContract({
        address: view.pool,
        abi: poolAbi,
        functionName: "mintSet",
        args: [account!, account!, amount],
        maxFeePerGas: 60_000_000_000n,
        maxPriorityFeePerGas: 2_000_000_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: h2 });

      await walletClient.writeContract({
        address: view.outcomeToken,
        abi: outcomeTokenAbi,
        functionName: "setOperator",
        args: [campaign, true],
        maxFeePerGas: 60_000_000_000n,
        maxPriorityFeePerGas: 2_000_000_000n,
      });

      const baseUpId = await publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "baseUpTokenId" });
      const baseDownId = await publicClient.readContract({ address: campaign, abi: campaignAbi, functionName: "baseDownTokenId" });
      // deposit requires the campaign to pull shares; the setOperator above covers it.
      await walletClient.writeContract({ address: campaign, abi: campaignAbi, functionName: "deposit", args: [0, amount], maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n });
      await walletClient.writeContract({ address: campaign, abi: campaignAbi, functionName: "deposit", args: [1, amount], maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n });
      void baseUpId; void baseDownId;
      setMsg("已资助基础任务 100 tUSDC");
    } catch (e) {
      setMsg(`失败: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const fundBonus = async () => {
    if (!walletClient || !view) return;
    setBusy("fund-bonus");
    setMsg(null);
    try {
      const amount = 50n * UNIT;
      const h1 = await walletClient.writeContract({
        address: view.collateral, abi: collateralAbi, functionName: "approve", args: [view.pool, amount],
        maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: h1 });
      const h2 = await walletClient.writeContract({
        address: view.pool, abi: poolAbi, functionName: "mintSet", args: [account!, account!, amount],
        maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: h2 });
      await walletClient.writeContract({
        address: view.outcomeToken, abi: outcomeTokenAbi, functionName: "setOperator", args: [campaign, true],
        maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n,
      });
      await walletClient.writeContract({
        address: campaign, abi: campaignAbi, functionName: "deposit", args: [2, amount],
        maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n,
      });
      setMsg("已资助追加任务 50 tUSDC（押涨）");
    } catch (e) {
      setMsg(`失败: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const activate = async () => {
    if (!walletClient) return;
    setBusy("activate");
    try {
      const h = await walletClient.writeContract({
        address: campaign, abi: campaignAbi, functionName: "activateBase",
        maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
      setMsg("基础预算已合并锁定");
    } catch (e) {
      setMsg(`失败: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="wrap">
      <header className="head">
        <div>
          <h1>COMMON GROUND</h1>
          <p className="tag">不必相信同一个未来，也能共同完成一件事</p>
        </div>
        <div className="wallet">
          {!account ? (
            <button className="btn ghost" onClick={connect}>连接钱包</button>
          ) : (
            <div className="walletRow">
              <span className="addr">{account.slice(0, 6)}…{account.slice(-4)}</span>
              {signature ? (
                <span className="ok">✓ 已验证</span>
              ) : (
                <button className="btn" onClick={signIn}>签名验证</button>
              )}
            </div>
          )}
          {account && balances && (
            <div className="bal">
              <span>{fmtEth(balances.stt)} STT</span>
              <span>{fmt(balances.tUsdc)} tUSDC</span>
            </div>
          )}
        </div>
      </header>

      <section className="campaign">
        <label>
          计划合约
          <input value={campaign} onChange={(e) => setCampaign(e.target.value as Address)} />
        </label>
        {view && (
          <div className="stats">
            <div className="stat"><b>{PLAN_LABELS[view.planState]}</b><span>状态</span></div>
            <div className="stat"><b>{fmt(view.baseBudget)} tUSDC</b><span>基础预算</span></div>
            <div className="stat"><b>{fmt(view.bonusBudget)} tUSDC</b><span>追加预算</span></div>
          </div>
        )}
      </section>

      {view && (
        <section className="tasks">
          <article className="card">
            <h2>基础任务 · 无论如何都做</h2>
            <p>对固定 commit 执行基础回归与权限检查。资金来自互补份额合并，不依赖市场方向。</p>
            <div className="row">
              <span>状态 <b>{TASK_LABELS[view.baseTask[0]]}</b></span>
              <span>预算 <b>{fmt(view.baseTask[5])} tUSDC</b></span>
            </div>
            <button className="btn" disabled={!!busy || !account || !signature} onClick={fundBase}>
              {busy === "fund-base" ? "处理中…" : "资助基础任务 100 tUSDC"}
            </button>
          </article>

          <article className="card">
            <h2>追加任务 · 结算后才触发</h2>
            <p>仅当市场结果为 Up 时，才对同一 commit 追加边界/异常检查。条件不满足即跳过。</p>
            <div className="row">
              <span>状态 <b>{TASK_LABELS[view.bonusTask[0]]}</b></span>
              <span>预算 <b>{fmt(view.bonusTask[5])} tUSDC</b></span>
            </div>
            <button className="btn" disabled={!!busy || !account || !signature} onClick={fundBonus}>
              {busy === "fund-bonus" ? "处理中…" : "资助追加任务 50 tUSDC（押涨）"}
            </button>
          </article>
        </section>
      )}

      <footer className="foot">
        <button className="btn ghost" disabled={!!busy || !account || !signature} onClick={activate}>
          合并基础预算（activateBase）
        </button>
        {msg && <span className="msg">{msg}</span>}
      </footer>
    </main>
  );
}

export default App;
