"use client";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { useSearchParams } from "next/navigation";
import { parseEther, formatEther, parseUnits, formatUnits, decodeEventLog } from "viem";

const TOKEN_ADDRESS = "0xEf601624E09126E369887D2845B68F4f9e968831";
const SWAP_ADDRESS = "0x2697Dc3195Fc5B37047D5E50C2f22a016cF4e2CD";

const TOKEN_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
];

const SWAP_ABI = [
  { name: "getEthReserve", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getTokenReserve", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "swapETHForToken", type: "function", stateMutability: "payable", inputs: [{ name: "minTokenOut", type: "uint256" }], outputs: [] },
  { name: "swapTokenForETH", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tokenIn", type: "uint256" }, { name: "minEthOut", type: "uint256" }], outputs: [] },
];

const SWAP_ETH_EVENT = {
  type: "event", name: "SwapETHForToken",
  inputs: [
    { name: "user", type: "address", indexed: true },
    { name: "ethIn", type: "uint256", indexed: false },
    { name: "tokenOut", type: "uint256", indexed: false },
  ],
};
const SWAP_TOKEN_EVENT = {
  type: "event", name: "SwapTokenForETH",
  inputs: [
    { name: "user", type: "address", indexed: true },
    { name: "tokenIn", type: "uint256", indexed: false },
    { name: "ethOut", type: "uint256", indexed: false },
  ],
};
const EVENTS_ABI = [SWAP_ETH_EVENT, SWAP_TOKEN_EVENT];

const GAS_BUFFER = parseEther("0.0005");
const SLIPPAGE_OPTIONS = [50, 100, 300];
const EXPLORER_TX_BASE = "https://eth-sepolia.blockscout.com/tx/";
const HISTORY_STORAGE_PREFIX = "rialo_swap_history_";

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

function decodeSwapFromReceipt(receipt) {
  if (!receipt || !receipt.logs) return null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: EVENTS_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === "SwapETHForToken") {
        return {
          type: "ETH_TO_RIALO",
          amountIn: formatNice(formatEther(decoded.args.ethIn), 5),
          amountOut: formatNice(formatUnits(decoded.args.tokenOut, 18), 2),
          hash: receipt.transactionHash,
        };
      }
      if (decoded.eventName === "SwapTokenForETH") {
        return {
          type: "RIALO_TO_ETH",
          amountIn: formatNice(formatUnits(decoded.args.tokenIn, 18), 2),
          amountOut: formatNice(formatEther(decoded.args.ethOut), 5),
          hash: receipt.transactionHash,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function useAnimatedDots(active) {
  const [dots, setDots] = useState("");
  useEffect(() => {
    if (!active) { setDots(""); return; }
    const seq = ["", ".", "..", "..."];
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % seq.length;
      setDots(seq[i]);
    }, 350);
    return () => clearInterval(timer);
  }, [active]);
  return dots;
}

function SwapContent() {
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const [direction, setDirection] = useState("ETH_TO_RIALO");
  const [amountIn, setAmountIn] = useState("");

  useEffect(() => {
    const urlDirection = searchParams.get("direction");
    const urlAmount = searchParams.get("amount");
    if (urlDirection === "ETH_TO_RIALO" || urlDirection === "RIALO_TO_ETH") {
      setDirection(urlDirection);
    }
    if (urlAmount && !isNaN(Number(urlAmount)) && Number(urlAmount) > 0) {
      setAmountIn(urlAmount);
    }
  }, [searchParams]);
  const [slippageBps, setSlippageBps] = useState(100);
  const [errorMsg, setErrorMsg] = useState("");
  const [history, setHistory] = useState([]);

  const storageKey = address ? HISTORY_STORAGE_PREFIX + address.toLowerCase() : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      setHistory(saved ? JSON.parse(saved) : []);
    } catch {
      setHistory([]);
    }
  }, [storageKey]);

  const { data: ethReserve, refetch: refetchEthReserve } = useReadContract({ address: SWAP_ADDRESS, abi: SWAP_ABI, functionName: "getEthReserve" });
  const { data: tokenReserve, refetch: refetchTokenReserve } = useReadContract({ address: SWAP_ADDRESS, abi: SWAP_ABI, functionName: "getTokenReserve" });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: TOKEN_ABI,
    functionName: "allowance",
    args: address ? [address, SWAP_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  const { data: ethBalance, refetch: refetchEthBalance } = useBalance({ address, query: { enabled: !!address } });
  const { data: rialoBalanceRaw, refetch: refetchRialoBalance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const currentBalanceWei = direction === "ETH_TO_RIALO" ? (ethBalance?.value ?? 0n) : (rialoBalanceRaw ?? 0n);
  const currentBalanceLabel = direction === "ETH_TO_RIALO"
    ? (ethBalance ? formatNice(formatEther(ethBalance.value), 5) : "0")
    : (rialoBalanceRaw !== undefined ? formatNice(formatUnits(rialoBalanceRaw, 18), 2) : "0");

  function setPercentage(pct) {
    if (!address) return;
    let base = currentBalanceWei;
    if (direction === "ETH_TO_RIALO" && pct === 100) {
      base = base > GAS_BUFFER ? base - GAS_BUFFER : 0n;
    }
    const amount = (base * BigInt(pct)) / 100n;
    const formatted = direction === "ETH_TO_RIALO" ? formatEther(amount) : formatUnits(amount, 18);
    setAmountIn(formatted);
  }

  const estimatedOut = useMemo(() => {
    if (!amountIn || !ethReserve || !tokenReserve) return "0";
    try {
      const amountInWei = direction === "ETH_TO_RIALO" ? parseEther(amountIn) : parseUnits(amountIn, 18);
      const reserveIn = direction === "ETH_TO_RIALO" ? ethReserve : tokenReserve;
      const reserveOut = direction === "ETH_TO_RIALO" ? tokenReserve : ethReserve;
      const amountInWithFee = amountInWei * 9970n;
      const numerator = amountInWithFee * reserveOut;
      const denominator = reserveIn * 10000n + amountInWithFee;
      const out = numerator / denominator;
      return direction === "ETH_TO_RIALO" ? formatUnits(out, 18) : formatEther(out);
    } catch {
      return "0";
    }
  }, [amountIn, ethReserve, tokenReserve, direction]);

  const priceImpact = useMemo(() => {
    if (!amountIn || !ethReserve || !tokenReserve || Number(amountIn) <= 0) return 0;
    try {
      const amountInWei = direction === "ETH_TO_RIALO" ? parseEther(amountIn) : parseUnits(amountIn, 18);
      const reserveIn = direction === "ETH_TO_RIALO" ? ethReserve : tokenReserve;
      const reserveOut = direction === "ETH_TO_RIALO" ? tokenReserve : ethReserve;
      const noImpactOut = (amountInWei * reserveOut) / reserveIn;
      const actualOutWei = direction === "ETH_TO_RIALO" ? parseUnits(estimatedOut || "0", 18) : parseEther(estimatedOut || "0");
      if (noImpactOut === 0n) return 0;
      const diff = noImpactOut - actualOutWei;
      const impactBps = (diff * 10000n) / noImpactOut;
      return Number(impactBps) / 100;
    } catch {
      return 0;
    }
  }, [amountIn, ethReserve, tokenReserve, direction, estimatedOut]);

  const { writeContract: approve, data: approveHash, isPending: approving, error: approveError } = useWriteContract();
  const { writeContract: swap, data: swapHash, isPending: swapping, error: swapWriteError } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { data: swapReceipt, isLoading: swapConfirming, isSuccess: swapSuccess, isError: swapReceiptError } = useWaitForTransactionReceipt({ hash: swapHash });

  const approveBusy = approving || approveConfirming;
  const swapBusy = swapping || swapConfirming;
  const approveDots = useAnimatedDots(approveBusy);
  const swapDots = useAnimatedDots(swapBusy);

  useEffect(() => {
    if (approveError) setErrorMsg(approveError.shortMessage || "Approve failed. Please try again.");
  }, [approveError]);

  useEffect(() => {
    if (swapWriteError) setErrorMsg(swapWriteError.shortMessage || "Swap was rejected or failed.");
  }, [swapWriteError]);

  useEffect(() => {
    if (swapReceiptError) setErrorMsg("Transaction failed on-chain. Please check and try again.");
  }, [swapReceiptError]);

  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
      setErrorMsg("");
    }
  }, [approveSuccess]);

  useEffect(() => {
    if (swapSuccess && swapReceipt && storageKey) {
      refetchEthReserve();
      refetchTokenReserve();
      refetchEthBalance();
      refetchRialoBalance();
      refetchAllowance();
      setAmountIn("");
      setErrorMsg("");

      const entry = decodeSwapFromReceipt(swapReceipt);
      if (entry) {
        setHistory((prev) => {
          const exists = prev.some((h) => h.hash === entry.hash);
          const updated = exists ? prev : [entry, ...prev].slice(0, 10);
          try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
          return updated;
        });
      }
    }
  }, [swapSuccess, swapReceipt, storageKey]);

  const amountInWeiForCheck = (() => {
    try { return amountIn ? parseUnits(amountIn, 18) : 0n; } catch { return 0n; }
  })();
  const needsApproval = direction === "RIALO_TO_ETH" && amountIn && allowance !== undefined && amountInWeiForCheck > allowance;
  const insufficientBalance = amountIn && (() => {
    try {
      const wei = direction === "ETH_TO_RIALO" ? parseEther(amountIn) : parseUnits(amountIn, 18);
      return wei > currentBalanceWei;
    } catch { return false; }
  })();

  function handleApprove() {
    setErrorMsg("");
    approve({
      address: TOKEN_ADDRESS,
      abi: TOKEN_ABI,
      functionName: "approve",
      args: [SWAP_ADDRESS, parseUnits("1000000", 18)],
    });
  }

  function handleSwap() {
    if (!amountIn || Number(amountIn) <= 0) return;
    setErrorMsg("");
    try {
      if (direction === "ETH_TO_RIALO") {
        const amountInWei = parseEther(amountIn);
        const minOut = (parseUnits(estimatedOut || "0", 18) * (10000n - BigInt(slippageBps))) / 10000n;
        swap({ address: SWAP_ADDRESS, abi: SWAP_ABI, functionName: "swapETHForToken", args: [minOut], value: amountInWei });
      } else {
        const amountInWei = parseUnits(amountIn, 18);
        const minOut = (parseEther(estimatedOut || "0") * (10000n - BigInt(slippageBps))) / 10000n;
        swap({ address: SWAP_ADDRESS, abi: SWAP_ABI, functionName: "swapTokenForETH", args: [amountInWei, minOut] });
      }
    } catch (e) {
      setErrorMsg("Invalid amount.");
    }
  }

  function flipDirection() {
    setDirection(direction === "ETH_TO_RIALO" ? "RIALO_TO_ETH" : "ETH_TO_RIALO");
    setAmountIn("");
    setErrorMsg("");
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
          <a href="/" style={{ textDecoration: "none", color: "#d7ff1f", fontWeight: 700 }}>← RialoVerse</a>
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
            <button
              key={bps}
              onClick={() => setSlippageBps(bps)}
              style={{
                padding: "4px 10px", fontSize: 11, borderRadius: 999, cursor: "pointer",
                border: slippageBps === bps ? "2px solid #d7ff1f" : "2px solid #2a2b3a",
                background: slippageBps === bps ? "#1a1b26" : "#111218",
                color: "#d7ff1f", fontWeight: 600,
              }}
            >
              {bps / 100}%
            </button>
          ))}
        </div>

        <div style={{ background: "#15161f", borderRadius: 0, padding: 14, marginBottom: 8, boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "#8a8b9c" }}>You pay</label>
            {address && (
              <span style={{ fontSize: 12, color: "#8a8b9c" }}>
                Balance: {currentBalanceLabel} {direction === "ETH_TO_RIALO" ? "ETH" : "RIALO"}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, minWidth: 0 }}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(sanitizeDecimalInput(e.target.value))}
              style={{ flex: "1 1 0%", minWidth: 0, width: 0, border: "none", background: "transparent", fontSize: 22, outline: "none" }}
            />
            <span style={{ fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>{direction === "ETH_TO_RIALO" ? "ETH" : "RIALO"}</span>
          </div>
          {address && (
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setPercentage(pct)}
                  style={{ flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "2px solid #2a2b3a", background: "#0a0a0a", color: "#d7ff1f", cursor: "pointer" }}
                >
                  {pct === 100 ? "MAX" : `${pct}%`}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
          <button onClick={flipDirection} style={{ background: "#1a1b26", borderRadius: 0, border: "2px solid #d7ff1f", color: "#d7ff1f", fontSize: 18, width: 36, height: 36, cursor: "pointer" }}>⇅</button>
        </div>

        <div style={{ background: "#15161f", borderRadius: 0, padding: 14, marginBottom: 10, boxSizing: "border-box" }}>
          <label style={{ fontSize: 12, color: "#8a8b9c" }}>You receive (estimated)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, minWidth: 0 }}>
            <div style={{ flex: "1 1 0%", minWidth: 0, fontSize: 22, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {formatNice(estimatedOut)}
            </div>
            <span style={{ fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>{direction === "ETH_TO_RIALO" ? "RIALO" : "ETH"}</span>
          </div>
        </div>

        {amountIn && Number(amountIn) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: highImpact ? "#dc2626" : "#888", marginBottom: 14, padding: "0 2px" }}>
            <span>Price impact</span>
            <span style={{ fontWeight: highImpact ? 700 : 400 }}>{priceImpact.toFixed(2)}%{highImpact ? " ⚠️ High" : ""}</span>
          </div>
        )}

        {insufficientBalance && (
          <p style={{ color: "#ff4d4d", fontSize: 13, textAlign: "center", marginBottom: 10 }}>Insufficient balance.</p>
        )}

        {!isConnected ? (
          <button onClick={openConnectModal} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#d7ff1f", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16 }}>
            Connect Wallet
          </button>
        ) : needsApproval ? (
          <button onClick={handleApprove} disabled={approveBusy} className={approveBusy ? "rialo-pulsing" : ""} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#f59e0b", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>
            {approveBusy ? `Approving${approveDots}` : "Approve RIALO"}
          </button>
        ) : (
          <button onClick={handleSwap} disabled={buttonDisabled} className={swapBusy ? "rialo-pulsing" : ""} style={{ width: "100%", padding: 14, borderRadius: 12, background: buttonDisabled ? "#333" : "#d7ff1f", color: buttonDisabled ? "#888" : "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16, cursor: buttonDisabled ? "not-allowed" : "pointer" }}>
            {swapBusy ? `Swapping${swapDots}` : "Swap"}
          </button>
        )}

        {errorMsg && <p style={{ color: "#ff4d4d", marginTop: 12, textAlign: "center", fontSize: 13 }}>{errorMsg}</p>}
        {swapSuccess && <p style={{ color: "green", marginTop: 12, textAlign: "center" }}>Swap successful! ✅</p>}
        {approveSuccess && !swapSuccess && <p style={{ color: "green", marginTop: 12, textAlign: "center" }}>Approve successful, now click Swap.</p>}
      </div>

      {address && (
        <div style={{ width: "100%", maxWidth: 420, background: "#111218", borderRadius: 0, padding: 20, border: "2px solid #d7ff1f", boxShadow: "none", boxSizing: "border-box" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Recent Swaps</h3>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8a8b9c", textAlign: "center" }}>No swaps yet.</p>
          ) : (
            history.map((tx, i) => (
              <a
                key={tx.hash + i}
                href={`${EXPLORER_TX_BASE}${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < history.length - 1 ? "1px solid #f0f0f0" : "none", textDecoration: "none", color: "inherit" }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {tx.type === "ETH_TO_RIALO" ? "ETH → RIALO" : "RIALO → ETH"}
                  </div>
                  <div style={{ fontSize: 11, color: "#8a8b9c" }}>
                    {tx.amountIn} {tx.type === "ETH_TO_RIALO" ? "ETH" : "RIALO"} → {tx.amountOut} {tx.type === "ETH_TO_RIALO" ? "RIALO" : "ETH"}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "#d7ff1f" }}>View ↗</span>
              </a>
            ))
          )}
        </div>
      )}
    </main>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <SwapContent />
    </Suspense>
  );
}
