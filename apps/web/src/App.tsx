import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  http,
  parseAbi,
  webSocket,
  type Address,
} from "viem";
import {
  CHAIN,
  COLLATERAL_DECIMALS,
  DEMO_CAMPAIGN,
  FACTORY_ADDRESS,
  STT_FAUCET_URL,
  T_USDC,
  UNIT,
  WS_RPC,
  campaignAbi,
  collateralAbi,
  factoryAbi,
  outcomeTokenAbi,
  poolAbi,
} from "./config";
import { DEMO_STEPS, copy, type Lang } from "./copy";

const EXPLORER = "https://shannon-explorer.somnia.network";
const GITHUB = "https://github.com/rectinajh/common-ground";

const publicClient = createPublicClient({ chain: CHAIN, transport: http() });
const marketAbi = parseAbi([
  "function isResolved() view returns (bool)",
  "function isVoided() view returns (bool)",
]);

const fmt = (v: bigint) => (Number(v) / 10 ** COLLATERAL_DECIMALS).toFixed(2);
const fmtEth = (v: bigint) => (Number(v) / 1e18).toFixed(4);
const shortHash = (h: string) => (h.length > 18 ? `${h.slice(0, 18)}…` : h);
const shortAddr = (a: string) => (a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const ZERO_HASH = `0x${"0".repeat(64)}`;
type Copy = (typeof copy)[Lang];

type TaskStruct = {
  state: number;
  evidenceHash: `0x${string}`;
  evidenceUri: string;
  reasonHash: `0x${string}`;
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
  module: Address;
  operatorId: number;
  venueId: `0x${string}`;
  marketId: `0x${string}`;
  bonusOutcomeIdx: number;
  baseUpTokenId: bigint;
  baseDownTokenId: bigint;
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
        contributorCount, mergedAmount, baseTask, bonusTask, market, collateral, pool,
        outcomeToken, module, operatorId, venueId, marketId, bonusOutcomeIdx,
        baseUpTokenId, baseDownTokenId,
      ] = await Promise.all([
        read("planState"), read("baseBudget"), read("bonusBudget"),
        read("totalBaseUp"), read("totalBaseDown"), read("totalBonus"),
        read("contributorCount"), read("mergedAmount"),
        read("getTask", [0n]), read("getTask", [1n]),
        read("market"), read("collateralToken"), read("pool"), read("outcomeToken"),
        read("module"), read("operatorId"), read("venueId"), read("marketId"),
        read("bonusOutcomeIdx"), read("baseUpTokenId"), read("baseDownTokenId"),
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
        module: module as Address,
        operatorId: operatorId as number,
        venueId: venueId as `0x${string}`,
        marketId: marketId as `0x${string}`,
        bonusOutcomeIdx: bonusOutcomeIdx as number,
        baseUpTokenId: baseUpTokenId as bigint,
        baseDownTokenId: baseDownTokenId as bigint,
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

function FlowVisual({ baseBudget, t }: { baseBudget: bigint; t: Copy }) {
  return (
    <div className="flow">
      <div className="flowPair">
        <div className="chip up"><span>↑</span>{t.chipUp}</div>
        <div className="plus">+</div>
        <div className="chip down"><span>↓</span>{t.chipDown}</div>
      </div>
      <div className="wire" />
      <div className="chip merge">{t.chipMerge}</div>
      <div className="wire" />
      <div className="chip fund"><span>◎</span>{fmt(baseBudget)} tUSDC</div>
    </div>
  );
}

function App() {
  const [lang, setLang] = useState<Lang>("en");
  const t = copy[lang];
  const [campaign, setCampaign] = useState<Address>(DEMO_CAMPAIGN as Address);
  const [plans, setPlans] = useState<Address[]>([]);
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
    if (/user rejected|user denied|denied message signature|4001/i.test(m)) return "Transaction rejected in wallet";
    if (/insufficient funds|gas required exceeds allowance/i.test(m)) return "Insufficient STT for gas";
    if (/nonce too low|nonce too high/i.test(m)) return "Nonce conflict — retry shortly";
    if (/tradingnotactive/i.test(m)) return "Market is no longer trading";
    if (/faucetcapexceeded/i.test(m)) return "Faucet cap reached for now";
    if (/wrong network|chain mismatch/i.test(m)) return "Switch to Somnia Testnet (chainId 50312)";
    return m.length > 160 ? `${m.slice(0, 160)}…` : m;
  };

  const connect = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return notify("Please install MetaMask", "err");
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xC488" }] }).catch(
      () => eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0xC488",
          chainName: "Somnia Testnet",
          rpcUrls: ["https://dream-rpc.somnia.network"],
          nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
          blockExplorerUrls: [EXPLORER],
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
      notify("Signature verified", "ok");
    } catch (e) {
      notify(`Sign-in failed: ${friendlyError(e)}`, "err");
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

  const loadPlans = useCallback(async () => {
    const set = new Set<string>([DEMO_CAMPAIGN.toLowerCase()]);
    try {
      const count = (await publicClient.readContract({
        address: FACTORY_ADDRESS, abi: factoryAbi, functionName: "campaignCount",
      })) as bigint;
      for (let i = 0n; i < count; i++) {
        const c = (await publicClient.readContract({
          address: FACTORY_ADDRESS, abi: factoryAbi, functionName: "getCampaign", args: [i],
        })) as Address;
        set.add(c.toLowerCase());
      }
    } catch {
      // Factory read is best-effort.
    }
    setPlans([...set].map((a) => a as Address));
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const faucet = async () => {
    if (!walletClient || !account) return;
    setBusy("faucet");
    setStep("Claiming test tokens…");
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
      notify("Claimed 10,000 tUSDC", "ok");
    } catch (e) {
      notify(`Faucet failed: ${friendlyError(e)}`, "err");
    } finally {
      setBusy(null);
      setStep(null);
    }
  };

  const fundSide = async (side: "up" | "down") => {
    if (!walletClient || !view || !account) return;
    const amount = 100n * UNIT;
    setBusy(side);
    setMsg(null);
    try {
      const send = async (label: string, call: () => Promise<`0x${string}`>) => {
        setStep(label);
        const hash = await call();
        await publicClient.waitForTransactionReceipt({ hash });
      };
      await send("Approve collateral…", () =>
        walletClient.writeContract({ address: view.collateral, abi: collateralAbi, functionName: "approve", args: [view.pool, amount], ...FEES }));
      await send("Mint Up + Down set…", () =>
        walletClient.writeContract({ address: view.pool, abi: poolAbi, functionName: "mintSet", args: [account, account, amount], ...FEES }));
      await send("Authorize vault…", () =>
        walletClient.writeContract({ address: view.outcomeToken, abi: outcomeTokenAbi, functionName: "setOperator", args: [campaign, true], ...FEES }));
      await send(side === "up" ? "Deposit Up share…" : "Deposit Down share…", () =>
        walletClient.writeContract({ address: campaign, abi: campaignAbi, functionName: "deposit", args: [side === "up" ? 0 : 1, amount], ...FEES }));
      setStep("Done");
      notify(side === "up" ? "Funded Up · 100 tUSDC" : "Funded Down · 100 tUSDC", "ok");
      await refreshBalance();
      reload();
    } catch (e) {
      notify(`Failed: ${friendlyError(e)}`, "err");
    } finally {
      setBusy(null);
      setTimeout(() => setStep(null), 1500);
    }
  };

  const fundBonus = async () => {
    if (!walletClient || !view || !account) return;
    const amount = 50n * UNIT;
    setBusy("bonus");
    setMsg(null);
    try {
      const send = async (label: string, call: () => Promise<`0x${string}`>) => {
        setStep(label);
        const hash = await call();
        await publicClient.waitForTransactionReceipt({ hash });
      };
      await send("Approve collateral…", () =>
        walletClient.writeContract({ address: view.collateral, abi: collateralAbi, functionName: "approve", args: [view.pool, amount], ...FEES }));
      await send("Mint Up + Down set…", () =>
        walletClient.writeContract({ address: view.pool, abi: poolAbi, functionName: "mintSet", args: [account, account, amount], ...FEES }));
      await send("Authorize vault…", () =>
        walletClient.writeContract({ address: view.outcomeToken, abi: outcomeTokenAbi, functionName: "setOperator", args: [campaign, true], ...FEES }));
      await send("Deposit bonus share…", () =>
        walletClient.writeContract({ address: campaign, abi: campaignAbi, functionName: "deposit", args: [2, amount], ...FEES }));
      setStep("Done");
      notify("Bonus funded · 50 tUSDC", "ok");
      await refreshBalance();
      reload();
    } catch (e) {
      notify(`Failed: ${friendlyError(e)}`, "err");
    } finally {
      setBusy(null);
      setTimeout(() => setStep(null), 1500);
    }
  };

  const activate = async () => {
    if (!walletClient) return;
    setBusy("activate");
    setStep("Merging complementary shares…");
    try {
      const h = await walletClient.writeContract({ address: campaign, abi: campaignAbi, functionName: "activateBase", ...FEES });
      await publicClient.waitForTransactionReceipt({ hash: h });
      notify("Base budget merged and locked", "ok");
      reload();
    } catch (e) {
      notify(`Failed: ${friendlyError(e)}`, "err");
    } finally {
      setBusy(null);
      setStep(null);
    }
  };

  const createPlan = async () => {
    if (!walletClient || !view || !account) return;
    setBusy("create");
    setStep("Deploying new plan…");
    setMsg(null);
    try {
      const hash = await walletClient.writeContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "createPlan",
        args: [
          view.module, view.pool, view.market, view.outcomeToken, view.collateral,
          view.baseUpTokenId, view.baseDownTokenId, view.bonusOutcomeIdx,
          view.operatorId, view.venueId, view.marketId,
          account, account, account, 32n,
        ],
        ...FEES,
        gas: 60_000_000n,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const created = receipt.logs
        .map((log) => {
          try {
            return decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics });
          } catch {
            return null;
          }
        })
        .find((d) => d?.eventName === "PlanCreated");
      const newPlan = created ? (created.args as { campaign: Address }).campaign : null;
      await loadPlans();
      if (newPlan) setCampaign(newPlan);
      notify(newPlan ? `New plan: ${shortAddr(newPlan)}` : "New plan created", "ok");
    } catch (e) {
      notify(`Create failed: ${friendlyError(e)}`, "err");
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
          <span>{t.brand}</span>
          <span className={`live ${live ? "on" : ""}`} title={live ? "Live event stream connected" : "Polling (stream offline)"}>
            <i />{live ? t.live : t.poll}
          </span>
        </div>
        <div className="wallet">
          <button className="mini" onClick={() => setLang(lang === "en" ? "zh" : "en")}>{t.switchLang}</button>
          {!account ? (
            <button className="btn ghost" onClick={connect}>{t.connect}</button>
          ) : (
            <>
              <span className="addr">{account.slice(0, 6)}…{account.slice(-4)}</span>
              {signature ? <span className="ok">✓ {t.signed}</span> : <button className="btn" onClick={signIn}>{t.signIn}</button>}
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
            {busy === "faucet" ? step ?? "…" : t.faucetTusdc}
          </button>
          <a className="mini link" href={STT_FAUCET_URL} target="_blank" rel="noreferrer">{t.faucetStt}</a>
        </div>
      )}

      <section className="judge">
        <span className="kicker">{t.judgeKicker}</span>
        <p>{t.judgeLine}</p>
      </section>

      <section className="hero">
        <h1>
          {t.hero1}
          <br />
          <span className="grad">{t.hero2}</span>
        </h1>
        <p className="sub">
          <code>{t.subBefore}</code>{t.subAfter}
        </p>
        {loading && !view && <p className="loadingHint">{t.loading}</p>}
        {view && <FlowVisual baseBudget={view.baseBudget} t={t} />}
      </section>

      <section className="onboard">
        <span className="step"><b>①</b>{t.onboard1}</span>
        <span className="arrow">→</span>
        <span className="step"><b>②</b>{t.onboard2}</span>
        <span className="arrow">→</span>
        <span className="step"><b>③</b>{t.onboard3}</span>
      </section>

      <section className="plans">
        <div className="plansHead">
          <span className="k">{t.plans} ({plans.length})</span>
          <button className="mini" disabled={!ready || !!busy} onClick={createPlan}>
            {busy === "create" ? step ?? t.creating : t.create}
          </button>
        </div>
        <div className="planSelect">
          {plans.map((p) => (
            <button
              key={p}
              className={`planChip ${p.toLowerCase() === campaign.toLowerCase() ? "active" : ""}`}
              onClick={() => setCampaign(p)}
            >
              {p.toLowerCase() === DEMO_CAMPAIGN.toLowerCase() ? t.demoPlan : shortAddr(p)}
            </button>
          ))}
        </div>
      </section>

      <section className="stats">
        <div className="stat">
          <span className="k">{t.planState}</span>
          <b>{view ? (t.planLabels[view.planState] ?? "—") : "—"}</b>
        </div>
        <div className="stat">
          <span className="k">{t.baseBudget}</span>
          <b className="c1">{view ? fmt(view.baseBudget) : "—"}<small> tUSDC</small></b>
        </div>
        <div className="stat">
          <span className="k">{t.bonusBudget}</span>
          <b className="c2">{view ? fmt(view.bonusBudget) : "—"}<small> tUSDC</small></b>
        </div>
        <div className="stat">
          <span className="k">{t.contributors}</span>
          <b>{view ? view.contributorCount.toString() : "—"}</b>
        </div>
      </section>

      <section className="tasks">
        <article className="card base">
          <div className="cardHead">
            <span className="badge base">{t.unconditional}</span>
            <span className={`state s${view?.baseTask.state ?? 0}`}>{view ? (t.taskLabels[view.baseTask.state] ?? "—") : "—"}</span>
          </div>
          <h2>{t.baseTitle}</h2>
          <p>{t.baseBody}</p>
          {view && view.baseTask.evidenceHash !== ZERO_HASH && (
            <div className="evidence">
              <span>{t.evidence}</span>
              <code title={view.baseTask.evidenceUri}>
                {shortHash(view.baseTask.evidenceHash)}
                {view.baseTask.evidenceUri ? ` · ${view.baseTask.evidenceUri.slice(0, 40)}` : ""}
              </code>
            </div>
          )}
          {view && view.baseTask.reasonHash !== ZERO_HASH && (
            <div className="evidence">
              <span>{t.reason}</span>
              <code>{shortHash(view.baseTask.reasonHash)}</code>
            </div>
          )}
          <div className="cardFoot">
            <span>{t.budget} <b>{view ? fmt(view.baseTask.budget) : "—"} tUSDC</b></span>
            <div className="footBtns">
              <button className="btn upBtn" disabled={!ready || !!busy} onClick={() => fundSide("up")}>
                {busy === "up" ? step ?? "…" : t.fundUp}
              </button>
              <button className="btn downBtn" disabled={!ready || !!busy} onClick={() => fundSide("down")}>
                {busy === "down" ? step ?? "…" : t.fundDown}
              </button>
            </div>
          </div>
        </article>

        <article className="card bonus">
          <div className="cardHead">
            <span className="badge bonus">{t.conditional}</span>
            <span className={`state s${view?.bonusTask.state ?? 0}`}>{view ? (t.taskLabels[view.bonusTask.state] ?? "—") : "—"}</span>
          </div>
          <h2>{t.bonusTitle}</h2>
          <p>{t.bonusBody}</p>
          {view && view.bonusTask.evidenceHash !== ZERO_HASH && (
            <div className="evidence">
              <span>{t.evidence}</span>
              <code title={view.bonusTask.evidenceUri}>
                {shortHash(view.bonusTask.evidenceHash)}
                {view.bonusTask.evidenceUri ? ` · ${view.bonusTask.evidenceUri.slice(0, 40)}` : ""}
              </code>
            </div>
          )}
          {view && view.bonusTask.reasonHash !== ZERO_HASH && (
            <div className="evidence">
              <span>{t.reason}</span>
              <code>{shortHash(view.bonusTask.reasonHash)}</code>
            </div>
          )}
          <div className="cardFoot">
            <span>{t.budget} <b>{view ? fmt(view.bonusTask.budget) : "—"} tUSDC</b></span>
            <button className="btn amber" disabled={!ready || !!busy} onClick={fundBonus}>
              {busy === "bonus" ? step ?? "…" : t.fundBonus}
            </button>
          </div>
        </article>
      </section>

      {view?.settled && <div className="settledNote">{t.settledNote}</div>}

      <section className="story">
        <div className="storyHead">
          <div>
            <span className="kicker">{t.storyTitle}</span>
            <h2>{t.storyTitle}</h2>
            <p>{t.storyLead}</p>
          </div>
          <div className="storyResult">
            <span className="k">{t.storyResult}</span>
            <b>{t.resultBase}</b>
            <b className="dim">{t.resultBonus}</b>
          </div>
        </div>
        <ul className="timeline">
          {DEMO_STEPS.map((s, i) => (
            <li key={s.tx}>
              <span className="n">{i + 1}</span>
              <div>
                <strong>{s.title[lang]}</strong>
                <p>{s.detail[lang]}</p>
              </div>
              <a href={`${EXPLORER}/tx/${s.tx}`} target="_blank" rel="noreferrer">{t.openTx} ↗</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="proof">
        <span className="k">{t.proofTitle}</span>
        <div className="proofLinks">
          <a href={GITHUB} target="_blank" rel="noreferrer">{t.github} ↗</a>
          <a href={`${EXPLORER}/address/${FACTORY_ADDRESS}`} target="_blank" rel="noreferrer">{t.openAddr}: Factory ↗</a>
          <a href={`${EXPLORER}/address/${campaign}`} target="_blank" rel="noreferrer">{t.openAddr}: Campaign ↗</a>
        </div>
      </section>

      <section className="bar">
        <div className="barLeft">
          <span className="k">{t.campaign}</span>
          <input value={campaign} onChange={(e) => setCampaign(e.target.value as Address)} spellCheck={false} />
        </div>
        <div className="barRight">
          {view?.settled && <span className="settled">{t.settled}</span>}
          <button className="btn ghost" disabled={!ready || !!busy} onClick={activate}>
            {busy === "activate" ? step ?? t.merging : t.mergeBtn}
          </button>
        </div>
      </section>

      {msg && <div className={`toast ${msgType}`}>{msg}</div>}
    </div>
  );
}

export default App;
