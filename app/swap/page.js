"use client";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { useSearchParams } from "next/navigation";
import { parseEther, formatEther, parseUnits, formatUnits, decodeEventLog } from "viem";

const TOKEN_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
];

const LEGACY_SWAP_ABI = [
  { name: "getEthReserve", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getTokenReserve", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "swapETHForToken", type: "function", stateMutability: "payable", inputs: [{ name: "minTokenOut", type: "uint256" }], outputs: [] },
  { name: "swapTokenForETH", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tokenIn", type: "uint256" }, { name: "minEthOut", type: "uint256" }], outputs: [] },
];

const GENERIC_SWAP_ABI = [
  { name: "getEthReserve", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getTokenReserve", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "swapEthForToken", type: "function", stateMutability: "payable", inputs: [{ name: "minTokenOut", type: "uint256" }], outputs: [] },
  { name: "swapTokenForEth", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tokenAmount", type: "uint256" }, { name: "minEthOut", type: "uint256" }], outputs: [] },
];

const SWAP_ETH_EVENT = {
  type: "event", name: "SwapETHForToken",
  inputs: [{ name: "user", type: "address", indexed: true }, { name: "ethIn", type: "uint256", indexed: false }, { name: "tokenOut", type: "uint256", indexed: false }],
};
const SWAP_TOKEN_EVENT = {
  type: "event", name: "SwapTokenForETH",
  inputs: [{ name: "user", type: "address", indexed: true }, { name: "tokenIn", type: "uint256", indexed: false }, { name: "ethOut", type: "uint256", indexed: false }],
};
const GENERIC_SWAP_EVENT = {
  type: "event", name: "Swap",
  inputs: [{ name: "user", type: "address", indexed: true }, { name: "ethToToken", type: "bool", indexed: false }, { name: "amountIn", type: "uint256", indexed: false }, { name: "amountOut", type: "uint256", indexed: false }],
};

const POOLS = {
  RIALO: {
    symbol: "RIALO", decimals: 18,
    tokenAddress: "0xEf601624E09126E369887D2845B68F4f9e968831",
    swapAddress: "0x2697Dc3195Fc5B37047D5E50C2f22a016cF4e2CD",
    swapAbi: LEGACY_SWAP_ABI, ethFnName: "swapETHForToken", tokenFnName: "swapTokenForETH", kind: "legacy",
    iconLetter: "R", iconBg: "#d7ff1f", iconColor: "#0a0a0a",
  },
  USDC: {
    symbol: "USDC", decimals: 6,
    tokenAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    swapAddress: "0x4168105b335d1ae53f52fB6dAf6F35aa4816036b",
    swapAbi: GENERIC_SWAP_ABI, ethFnName: "swapEthForToken", tokenFnName: "swapTokenForEth", kind: "generic",
    iconLetter: "$", iconBg: "#2775CA", iconColor: "#fff",
  },
};

const TOKEN_LIST = ["ETH", "RIALO", "USDC"];
const GAS_BUFFER = parseEther("0.0005");
const SLIPPAGE_OPTIONS = [50, 100, 300];
const EXPLORER_TX_BASE = "https://eth-sepolia.blockscout.com/tx/";

function decimalsOf(sym) { return sym === "ETH" ? 18 : POOLS[sym].decimals; }

function TokenIcon({ token, size = 20 }) {
  if (token === "ETH") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: "#627eea", flexShrink: 0 }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
          <path d="M12 1L4 12.5L12 17L20 12.5L12 1Z" fill="#fff" fillOpacity="0.85"/>
          <path d="M12 18.3L4 13.6L12 23L20 13.6L12 18.3Z" fill="#fff"/>
          <path d="M12 1L4 12.5L12 16V1Z" fill="#fff"/>
          <path d="M12 18.3V23L4 13.6L12 18.3Z" fill="#fff" fillOpacity="0.6"/>
        </svg>
      </span>
    );
  }
  const cfg = POOLS[token];
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: cfg.iconBg, color: cfg.iconColor, fontSize: size * 0.5, fontWeight: 800, flexShrink: 0 }}>{cfg.iconLetter}</span>;
}

function formatNice(numStr, maxDecimals = 6) {
  const n = Number(numStr);
  if (!isFinite(n)) return "0";
  if (n === 0) return "0";
  if (n < 0.000001) return "<0.000001";
  return n.toFixed(maxDecimals).replace(/\.?0+$/, "") || "0";
}

function sanitizeDecimalInput(raw) {
  let v = raw.replace(/,/g, ".");
  v = v.replace(/[^0-9.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  return v;
}

function quoteOut(amountInWei, reserveIn, reserveOut) {
  if (!reserveIn || !reserveOut || amountInWei <= 0n) return 0n;
  const amountInWithFee = amountInWei * 9970n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;
  return numerator / denominator;
}

function decodeHopReceipt(receipt, poolKey) {
  if (!receipt || !receipt.logs) return null;
  const pool = POOLS[poolKey];
  const abi = pool.kind === "legacy" ? [SWAP_ETH_EVENT, SWAP_TOKEN_EVENT] : [GENERIC_SWAP_EVENT];
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
      if (decoded.eventName === "SwapETHForToken") return { ethIn: decoded.args.ethIn, tokenOut: decoded.args.tokenOut, ethToToken: true };
      if (decoded.eventName === "SwapTokenForETH") return { tokenIn: decoded.args.tokenIn, ethOut: decoded.args.ethOut, ethToToken: false };
      if (decoded.eventName === "Swap") {
        if (decoded.args.ethToToken) return { ethIn: decoded.args.amountIn, tokenOut: decoded.args.amountOut, ethToToken: true };
        return { tokenIn: decoded.args.amountIn, ethOut: decoded.args.amountOut, ethToToken: false };
      }
    } catch { continue; }
  }
  return null;
}

function useAnimatedDots(active) {
  const [dots, setDots] = useState("");
  useEffect(() => {
    if (!active) { setDots(""); return; }
    const seq = ["", ".", "..", "..."];
    let i = 0;
    const timer = setInterval(() => { i = (i + 1) % seq.length; setDots(seq[i]); }, 350);
    return () => clearInterval(timer);
  }, [active]);
  return dots;
}

function SwapContent() {
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("RIALO");
  const [amountIn, setAmountIn] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);
  const [errorMsg, setErrorMsg] = useState("");
  const [swapStep, setSwapStep] = useState("idle");
  const [hop1EthOut, setHop1EthOut] = useState(null);

  useEffect(() => {
    const urlAmount = searchParams.get("amount");
    const urlFrom = searchParams.get("from");
    const urlTo = searchParams.get("to");
    const urlDirection = searchParams.get("direction");
    if (urlFrom && TOKEN_LIST.includes(urlFrom)) setFromToken(urlFrom);
    if (urlTo && TOKEN_LIST.includes(urlTo)) setToToken(urlTo);
    if (urlDirection === "ETH_TO_RIALO") { setFromToken("ETH"); setToToken("RIALO"); }
    if (urlDirection === "RIALO_TO_ETH") { setFromToken("RIALO"); setToToken("ETH"); }
    if (urlAmount && !isNaN(Number(urlAmount)) && Number(urlAmount) > 0) setAmountIn(urlAmount);
  }, [searchParams]);

  function selectFrom(sym) {
    if (sym === fromToken) return;
    setAmountIn(""); setErrorMsg(""); setSwapStep("idle");
    if (sym === toToken) setToToken(fromToken);
    setFromToken(sym);
  }
  function selectTo(sym) {
    if (sym === toToken) return;
    setAmountIn(""); setErrorMsg(""); setSwapStep("idle");
    if (sym === fromToken) setFromToken(toToken);
    setToToken(sym);
  }

  const routeType = fromToken === "ETH" ? "eth-to-token" : toToken === "ETH" ? "token-to-eth" : "routed";
  const directPoolKey = routeType === "eth-to-token" ? toToken : routeType === "token-to-eth" ? fromToken : null;
  const isRouted = routeType === "routed";

  const { data: rialoEth, refetch: refetchRialoEth } = useReadContract({ address: POOLS.RIALO.swapAddress, abi: POOLS.RIALO.swapAbi, functionName: "getEthReserve" });
  const { data: rialoTok, refetch: refetchRialoTok } = useReadContract({ address: POOLS.RIALO.swapAddress, abi: POOLS.RIALO.swapAbi, functionName: "getTokenReserve" });
  const { data: usdcEth, refetch: refetchUsdcEth } = useReadContract({ address: POOLS.USDC.swapAddress, abi: POOLS.USDC.swapAbi, functionName: "getEthReserve" });
  const { data: usdcTok, refetch: refetchUsdcTok } = useReadContract({ address: POOLS.USDC.swapAddress, abi: POOLS.USDC.swapAbi, functionName: "getTokenReserve" });

  const reserves = { RIALO: { eth: rialoEth, tok: rialoTok }, USDC: { eth: usdcEth, tok: usdcTok } };

  const { data: ethBalance, refetch: refetchEthBalance } = useBalance({ address, query: { enabled: !!address } });
  const { data: rialoBalance, refetch: refetchRialoBalance } = useReadContract({ address: POOLS.RIALO.tokenAddress, abi: TOKEN_ABI, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });
  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({ address: POOLS.USDC.tokenAddress, abi: TOKEN_ABI, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });

  const balances = { ETH: ethBalance?.value ?? 0n, RIALO: rialoBalance ?? 0n, USDC: usdcBalance ?? 0n };
  const currentBalanceWei = balances[fromToken] ?? 0n;
  const currentBalanceLabel = fromToken === "ETH"
    ? (ethBalance ? formatNice(formatEther(ethBalance.value), 5) : "0")
    : formatNice(formatUnits(currentBalanceWei, decimalsOf(fromToken)), 2);

  const fromPoolKey = fromToken !== "ETH" ? fromToken : null;
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: fromPoolKey ? POOLS[fromPoolKey].tokenAddress : undefined,
    abi: TOKEN_ABI, functionName: "allowance",
    args: address && fromPoolKey ? [address, POOLS[fromPoolKey].swapAddress] : undefined,
    query: { enabled: !!address && !!fromPoolKey },
  });

  function setPercentage(pct) {
    if (!address) return;
    let base = currentBalanceWei;
    if (fromToken === "ETH" && pct === 100) base = base > GAS_BUFFER ? base - GAS_BUFFER : 0n;
    const amount = (base * BigInt(pct)) / 100n;
    setAmountIn(fromToken === "ETH" ? formatEther(amount) : formatUnits(amount, decimalsOf(fromToken)));
  }

  const estimatedOutWei = useMemo(() => {
    if (!amountIn || Number(amountIn) <= 0) return 0n;
    try {
      const amountInWei = parseUnits(amountIn, decimalsOf(fromToken));
      if (routeType === "eth-to-token") {
        const r = reserves[toToken];
        return quoteOut(amountInWei, r.eth, r.tok);
      }
      if (routeType === "token-to-eth") {
        const r = reserves[fromToken];
        return quoteOut(amountInWei, r.tok, r.eth);
      }
      const r1 = reserves[fromToken];
      const hop1 = quoteOut(amountInWei, r1.tok, r1.eth);
      const r2 = reserves[toToken];
      return quoteOut(hop1, r2.eth, r2.tok);
    } catch { return 0n; }
  }, [amountIn, fromToken, toToken, routeType, rialoEth, rialoTok, usdcEth, usdcTok]);

  const estimatedOut = formatUnits(estimatedOutWei, decimalsOf(toToken));

  const priceImpact = useMemo(() => {
    if (!amountIn || Number(amountIn) <= 0) return 0;
    try {
      const amountInWei = parseUnits(amountIn, decimalsOf(fromToken));
      let noImpactOut;
      if (routeType === "eth-to-token") {
        const r = reserves[toToken];
        if (!r.eth || r.eth === 0n) return 0;
        noImpactOut = (amountInWei * r.tok) / r.eth;
      } else if (routeType === "token-to-eth") {
        const r = reserves[fromToken];
        if (!r.tok || r.tok === 0n) return 0;
        noImpactOut = (amountInWei * r.eth) / r.tok;
      } else {
        const r1 = reserves[fromToken];
        if (!r1.tok || r1.tok === 0n) return 0;
        const noImpactHop1 = (amountInWei * r1.eth) / r1.tok;
        const r2 = reserves[toToken];
        if (!r2.eth || r2.eth === 0n) return 0;
        noImpactOut = (noImpactHop1 * r2.tok) / r2.eth;
      }
      if (noImpactOut === 0n) return 0;
      const diff = noImpactOut - estimatedOutWei;
      return Number((diff * 10000n) / noImpactOut) / 100;
    } catch { return 0; }
  }, [amountIn, fromToken, toToken, routeType, estimatedOutWei]);

  const { writeContract: approve, data: approveHash, isPending: approving, error: approveError } = useWriteContract();
  const { writeContract: swap, data: swapHash, isPending: swapping, error: swapWriteError } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { data: swapReceipt, isLoading: swapConfirming, isSuccess: swapTxSuccess, isError: swapReceiptError } = useWaitForTransactionReceipt({ hash: swapHash });

  const approveBusy = approving || approveConfirming;
  const swapBusy = swapping || swapConfirming || swapStep === "hop1" || swapStep === "hop2";
  const approveDots = useAnimatedDots(approveBusy);
  const swapDots = useAnimatedDots(swapBusy);

  useEffect(() => { if (approveError) setErrorMsg(approveError.shortMessage || "Approve failed."); }, [approveError]);
  useEffect(() => { if (swapWriteError) setErrorMsg(swapWriteError.shortMessage || "Swap rejected or failed."); }, [swapWriteError]);
  useEffect(() => { if (swapReceiptError) setErrorMsg("Transaction failed on-chain."); }, [swapReceiptError]);
  useEffect(() => { if (approveSuccess) { refetchAllowance(); setErrorMsg(""); } }, [approveSuccess]);

  function refetchAll() {
    refetchRialoEth(); refetchRialoTok(); refetchUsdcEth(); refetchUsdcTok();
    refetchEthBalance(); refetchRialoBalance(); refetchUsdcBalance(); refetchAllowance();
  }

  useEffect(() => {
    if (!swapTxSuccess || !swapReceipt) return;
    if (swapStep === "hop1" && isRouted) {
      const decoded = decodeHopReceipt(swapReceipt, fromToken);
      const ethOut = decoded?.ethOut ?? 0n;
      setHop1EthOut(ethOut);
      const toPool = POOLS[toToken];
      const minOut = (quoteOut(ethOut, reserves[toToken].eth, reserves[toToken].tok) * (10000n - BigInt(slippageBps))) / 10000n;
      setSwapStep("hop2");
      swap({ address: toPool.swapAddress, abi: toPool.swapAbi, functionName: toPool.ethFnName, args: [minOut], value: ethOut });
    } else if (swapStep === "hop2" || (swapStep === "hop1" && !isRouted)) {
      setSwapStep("done");
      refetchAll();
      setAmountIn("");
      setErrorMsg("");
    }
  }, [swapTxSuccess, swapReceipt]);

  const amountInWeiForCheck = (() => { try { return amountIn ? parseUnits(amountIn, decimalsOf(fromToken)) : 0n; } catch { return 0n; } })();
  const needsApproval = fromToken !== "ETH" && amountIn && allowance !== undefined && amountInWeiForCheck > allowance;
  const insufficientBalance = amountIn && (() => { try { return amountInWeiForCheck > currentBalanceWei; } catch { return false; } })();

  function handleApprove() {
    setErrorMsg("");
    const pool = POOLS[fromToken];
    approve({ address: pool.tokenAddress, abi: TOKEN_ABI, functionName: "approve", args: [pool.swapAddress, parseUnits("1000000", pool.decimals)] });
  }

  function handleSwap() {
    if (!amountIn || Number(amountIn) <= 0) return;
    setErrorMsg("");
    try {
      const amountInWei = parseUnits(amountIn, decimalsOf(fromToken));
      const minOut = (estimatedOutWei * (10000n - BigInt(slippageBps))) / 10000n;
      if (routeType === "eth-to-token") {
        const pool = POOLS[toToken];
        setSwapStep("hop1");
        swap({ address: pool.swapAddress, abi: pool.swapAbi, functionName: pool.ethFnName, args: [minOut], value: amountInWei });
      } else if (routeType === "token-to-eth") {
        const pool = POOLS[fromToken];
        setSwapStep("hop1");
        swap({ address: pool.swapAddress, abi: pool.swapAbi, functionName: pool.tokenFnName, args: [amountInWei, minOut] });
      } else {
        const pool = POOLS[fromToken];
        const r1 = reserves[fromToken];
        const hop1MinOut = (quoteOut(amountInWei, r1.tok, r1.eth) * (10000n - BigInt(slippageBps))) / 10000n;
        setSwapStep("hop1");
        swap({ address: pool.swapAddress, abi: pool.swapAbi, functionName: pool.tokenFnName, args: [amountInWei, hop1MinOut] });
      }
    } catch (e) { setErrorMsg("Invalid amount."); }
  }

  const buttonDisabled = !amountIn || Number(amountIn) <= 0 || insufficientBalance || swapBusy;
  const highImpact = priceImpact > 5;

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, background: "#0a0a0a", boxSizing: "border-box", gap: 16 }}>
      <style>{`
        @keyframes rialoPulse { 0% { opacity: 1; } 50% { opacity: 0.55; } 100% { opacity: 1; } }
        .rialo-pulsing { animation: rialoPulse 1.1s ease-in-out infinite; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420, background: "#111218", borderRadius: 0, padding: 20, border: "2px solid #d7ff1f", boxShadow: "none", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <a href="/" style={{ textDecoration: "none", fontWeight: 700 }}><span style={{ color: "#fff" }}>← Rialo</span><span style={{ color: "#d7ff1f" }}>Verse</span></a>
          <h2 style={{ margin: 0, fontSize: 20 }}>Swap</h2>
        </div>

        {isConnected && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={openAccountModal} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999, border: "2px solid #d7ff1f", background: "#0a0a0a", color: "#d7ff1f", fontWeight: 600, cursor: "pointer" }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 10 }}>
          {SLIPPAGE_OPTIONS.map((bps) => (
            <button key={bps} onClick={() => setSlippageBps(bps)} style={{ padding: "4px 10px", fontSize: 11, borderRadius: 999, cursor: "pointer", border: slippageBps === bps ? "2px solid #d7ff1f" : "2px solid #2a2b3a", background: slippageBps === bps ? "#1a1b26" : "#111218", color: "#d7ff1f", fontWeight: 600 }}>
              {bps / 100}%
            </button>
          ))}
        </div>

        <div style={{ background: "#15161f", borderRadius: 0, padding: 14, marginBottom: 8, boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "#8a8b9c" }}>From</label>
            {address && <span style={{ fontSize: 12, color: "#8a8b9c" }}>Balance: {currentBalanceLabel} {fromToken}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, minWidth: 0 }}>
            <input type="text" inputMode="decimal" placeholder="0.0" value={amountIn} onChange={(e) => setAmountIn(sanitizeDecimalInput(e.target.value))}
              style={{ flex: "1 1 0%", minWidth: 0, width: 0, border: "none", background: "transparent", fontSize: 22, outline: "none", color: "#fff" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0a0a", border: "2px solid #2a2b3a", flexShrink: 0 }}>
              <TokenIcon token={fromToken} size={18} />
              <select value={fromToken} onChange={(e) => selectFrom(e.target.value)} style={{ background: "transparent", color: "#fff", border: "none", padding: "6px 6px 6px 0", fontWeight: 700, fontSize: 13 }}>
                {TOKEN_LIST.map((t) => <option key={t} value={t} style={{ background: "#0a0a0a" }}>{t}</option>)}
              </select>
            </div>
          </div>
          {address && (
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} onClick={() => setPercentage(pct)} style={{ flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "2px solid #2a2b3a", background: "#0a0a0a", color: "#d7ff1f", cursor: "pointer" }}>
                  {pct === 100 ? "MAX" : `${pct}%`}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
          <button onClick={() => { const f = fromToken; selectFrom(toToken); setToToken(f); }} style={{ background: "#1a1b26", borderRadius: 0, border: "2px solid #d7ff1f", color: "#d7ff1f", fontSize: 18, width: 36, height: 36, cursor: "pointer" }}>⇅</button>
        </div>

        <div style={{ background: "#15161f", borderRadius: 0, padding: 14, marginBottom: 6, boxSizing: "border-box" }}>
          <label style={{ fontSize: 12, color: "#8a8b9c" }}>To (estimated)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, minWidth: 0 }}>
            <div style={{ flex: "1 1 0%", minWidth: 0, fontSize: 22, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatNice(estimatedOut)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0a0a", border: "2px solid #2a2b3a", flexShrink: 0 }}>
              <TokenIcon token={toToken} size={18} />
              <select value={toToken} onChange={(e) => selectTo(e.target.value)} style={{ background: "transparent", color: "#fff", border: "none", padding: "6px 6px 6px 0", fontWeight: 700, fontSize: 13 }}>
                {TOKEN_LIST.map((t) => <option key={t} value={t} style={{ background: "#0a0a0a" }}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {isRouted && (
          <div style={{ fontSize: 11, color: "#8a8b9c", marginBottom: 10, padding: "0 2px" }}>Routed via ETH \u2022 2 transactions required</div>
        )}

        {amountIn && Number(amountIn) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: highImpact ? "#ff4d4d" : "#8a8b9c", marginBottom: 14, padding: "0 2px" }}>
            <span>Price impact</span>
            <span style={{ fontWeight: highImpact ? 700 : 400 }}>{priceImpact.toFixed(2)}%{highImpact ? " ⚠️ High" : ""}</span>
          </div>
        )}

        {insufficientBalance && <p style={{ color: "#ff4d4d", fontSize: 13, textAlign: "center", marginBottom: 10 }}>Insufficient balance.</p>}

        {!isConnected ? (
          <button onClick={openConnectModal} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#d7ff1f", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16 }}>Connect Wallet</button>
        ) : needsApproval ? (
          <button onClick={handleApprove} disabled={approveBusy} className={approveBusy ? "rialo-pulsing" : ""} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#f59e0b", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>
            {approveBusy ? `Approving${approveDots}` : `Approve ${fromToken}`}
          </button>
        ) : (
          <button onClick={handleSwap} disabled={buttonDisabled} className={swapBusy ? "rialo-pulsing" : ""} style={{ width: "100%", padding: 14, borderRadius: 12, background: buttonDisabled ? "#333" : "#d7ff1f", color: buttonDisabled ? "#888" : "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16, cursor: buttonDisabled ? "not-allowed" : "pointer" }}>
            {swapStep === "hop1" && isRouted ? `Step 1/2${swapDots}` : swapStep === "hop2" ? `Step 2/2${swapDots}` : swapBusy ? `Swapping${swapDots}` : "Swap"}
          </button>
        )}

        {errorMsg && <p style={{ color: "#ff4d4d", marginTop: 12, textAlign: "center", fontSize: 13 }}>{errorMsg}</p>}
        {swapStep === "done" && <p style={{ color: "green", marginTop: 12, textAlign: "center" }}>Swap successful! ✅</p>}
        {approveSuccess && <p style={{ color: "green", marginTop: 12, textAlign: "center" }}>Approve successful, now click Swap.</p>}
      </div>
    </main>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#fff" }}>Loading...</div>}>
      <SwapContent />
    </Suspense>
  );
}
