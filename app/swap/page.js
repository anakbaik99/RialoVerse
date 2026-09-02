"use client";
import { useState, useMemo, useEffect } from "react";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { parseEther, formatEther, parseUnits, formatUnits } from "viem";

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

const GAS_BUFFER = parseEther("0.0005");
const SLIPPAGE_OPTIONS = [50, 100, 300];

function formatNice(numStr, maxDecimals = 6) {
  const n = Number(numStr);
  if (!isFinite(n)) return "0";
  if (n === 0) return "0";
  if (n < 0.000001) return "<0.000001";
  return n.toFixed(maxDecimals).replace(/\.?0+$/, "") || "0";
}

export default function SwapPage() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [direction, setDirection] = useState("ETH_TO_RIALO");
  const [amountIn, setAmountIn] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);
  const [errorMsg, setErrorMsg] = useState("");

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
  const { isLoading: swapConfirming, isSuccess: swapSuccess, isError: swapReceiptError } = useWaitForTransactionReceipt({ hash: swapHash });

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
    if (swapSuccess) {
      refetchEthReserve();
      refetchTokenReserve();
      refetchEthBalance();
      refetchRialoBalance();
      refetchAllowance();
      setAmountIn("");
      setErrorMsg("");
    }
  }, [swapSuccess]);

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

  const buttonDisabled = !amountIn || Number(amountIn) <= 0 || insufficientBalance || swapping || swapConfirming;
  const highImpact = priceImpact > 5;

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#f5f4ff", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 8px 30px rgba(0,0,0,0.08)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <a href="/" style={{ textDecoration: "none", color: "#6d28d9", fontWeight: 700 }}>← RialoVerse</a>
          <h2 style={{ margin: 0, fontSize: 20 }}>Swap</h2>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 10 }}>
          {SLIPPAGE_OPTIONS.map((bps) => (
            <button
              key={bps}
              onClick={() => setSlippageBps(bps)}
              style={{
                padding: "4px 10px", fontSize: 11, borderRadius: 999, cursor: "pointer",
                border: slippageBps === bps ? "1px solid #6d28d9" : "1px solid #e0dcf5",
                background: slippageBps === bps ? "#ede9fe" : "#fff",
                color: "#6d28d9", fontWeight: 600,
              }}
            >
              {bps / 100}%
            </button>
          ))}
        </div>

        <div style={{ background: "#f7f7fb", borderRadius: 14, padding: 14, marginBottom: 8, boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "#888" }}>You pay</label>
            {address && (
              <span style={{ fontSize: 12, color: "#888" }}>
                Balance: {currentBalanceLabel} {direction === "ETH_TO_RIALO" ? "ETH" : "RIALO"}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, minWidth: 0 }}>
            <input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
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
                  style={{ flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "1px solid #e0dcf5", background: "#fff", color: "#6d28d9", cursor: "pointer" }}
                >
                  {pct === 100 ? "MAX" : `${pct}%`}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
          <button onClick={flipDirection} style={{ border: "none", background: "#ede9fe", borderRadius: 999, width: 36, height: 36, cursor: "pointer" }}>⇅</button>
        </div>

        <div style={{ background: "#f7f7fb", borderRadius: 14, padding: 14, marginBottom: 10, boxSizing: "border-box" }}>
          <label style={{ fontSize: 12, color: "#888" }}>You receive (estimated)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, minWidth: 0 }}>
            <div style={{ flex: "1 1 0%", minWidth: 0, fontSize: 22, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
          <p style={{ color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 10 }}>Insufficient balance.</p>
        )}

        {!isConnected ? (
          <button onClick={openConnectModal} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#6d28d9", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>
            Connect Wallet
          </button>
        ) : needsApproval ? (
          <button onClick={handleApprove} disabled={approving || approveConfirming} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#f59e0b", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>
            {approving || approveConfirming ? "Approving..." : "Approve RIALO"}
          </button>
        ) : (
          <button onClick={handleSwap} disabled={buttonDisabled} style={{ width: "100%", padding: 14, borderRadius: 12, background: buttonDisabled ? "#c4b5fd" : "#6d28d9", color: "#fff", border: "none", fontWeight: 700, fontSize: 16, cursor: buttonDisabled ? "not-allowed" : "pointer" }}>
            {swapping || swapConfirming ? "Swapping..." : "Swap"}
          </button>
        )}

        {errorMsg && <p style={{ color: "#dc2626", marginTop: 12, textAlign: "center", fontSize: 13 }}>{errorMsg}</p>}
        {swapSuccess && <p style={{ color: "green", marginTop: 12, textAlign: "center" }}>Swap successful! ✅</p>}
        {approveSuccess && !swapSuccess && <p style={{ color: "green", marginTop: 12, textAlign: "center" }}>Approve successful, now click Swap.</p>}
      </div>
    </main>
  );
}
