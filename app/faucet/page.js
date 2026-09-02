"use client";
import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatUnits } from "viem";

const TOKEN_ADDRESS = "0xEf601624E09126E369887D2845B68F4f9e968831";
const FAUCET_ADDRESS = "0xf049b73bf8ffd29eb256e12b0e7c8397a49e4141";

const TOKEN_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
];

const FAUCET_ABI = [
  { name: "claim", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "timeUntilNextClaim", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "faucetBalance", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "CLAIM_AMOUNT", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

function formatCountdown(seconds) {
  if (seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

export default function FaucetPage() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(0);

  const { data: rialoBalance, refetch: refetchBalance } = useReadContract({
    address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: !!address },
  });

  const { data: cooldownRemaining, refetch: refetchCooldown } = useReadContract({
    address: FAUCET_ADDRESS, abi: FAUCET_ABI, functionName: "timeUntilNextClaim",
    args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 15000 },
  });

  const { data: faucetBalance } = useReadContract({
    address: FAUCET_ADDRESS, abi: FAUCET_ABI, functionName: "faucetBalance",
  });

  const { data: claimAmount } = useReadContract({
    address: FAUCET_ADDRESS, abi: FAUCET_ABI, functionName: "CLAIM_AMOUNT",
  });

  useEffect(() => {
    if (cooldownRemaining !== undefined) setCountdown(Number(cooldownRemaining));
  }, [cooldownRemaining]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const { writeContract: claim, data: claimHash, isPending: claiming, error: claimError } = useWriteContract();
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash });

  useEffect(() => {
    if (claimError) setErrorMsg(claimError.shortMessage || "Claim failed. Please try again.");
  }, [claimError]);

  useEffect(() => {
    if (claimSuccess) {
      refetchBalance();
      refetchCooldown();
      setErrorMsg("");
    }
  }, [claimSuccess]);

  function handleClaim() {
    setErrorMsg("");
    claim({ address: FAUCET_ADDRESS, abi: FAUCET_ABI, functionName: "claim" });
  }

  const canClaim = isConnected && countdown <= 0 && !claiming && !claimConfirming;
  const faucetEmpty = faucetBalance !== undefined && claimAmount !== undefined && faucetBalance < claimAmount;

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#f5f4ff", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 8px 30px rgba(0,0,0,0.08)", boxSizing: "border-box", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <a href="/" style={{ textDecoration: "none", color: "#6d28d9", fontWeight: 700 }}>← RialoVerse</a>
          <h2 style={{ margin: 0, fontSize: 20 }}>Faucet</h2>
        </div>

        <div style={{ fontSize: 40, marginBottom: 8 }}>💧</div>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
          Claim free RIALO test tokens once every 24 hours.
        </p>

        {address && (
          <div style={{ background: "#f7f7fb", borderRadius: 14, padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#888" }}>Your RIALO balance</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
              {rialoBalance !== undefined ? Number(formatUnits(rialoBalance, 18)).toFixed(2) : "0"} RIALO
            </div>
          </div>
        )}

        {!isConnected ? (
          <button onClick={openConnectModal} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#6d28d9", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>
            Connect Wallet
          </button>
        ) : faucetEmpty ? (
          <button disabled style={{ width: "100%", padding: 14, borderRadius: 12, background: "#c4b5fd", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>
            Faucet Empty
          </button>
        ) : countdown > 0 ? (
          <button disabled style={{ width: "100%", padding: 14, borderRadius: 12, background: "#c4b5fd", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>
            Next claim in {formatCountdown(countdown)}
          </button>
        ) : (
          <button onClick={handleClaim} disabled={!canClaim} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#6d28d9", color: "#fff", border: "none", fontWeight: 700, fontSize: 16, cursor: canClaim ? "pointer" : "not-allowed" }}>
            {claiming || claimConfirming ? "Claiming..." : "Claim 50 RIALO"}
          </button>
        )}

        {errorMsg && <p style={{ color: "#dc2626", marginTop: 12, fontSize: 13 }}>{errorMsg}</p>}
        {claimSuccess && <p style={{ color: "green", marginTop: 12 }}>Claim successful! ✅ 50 RIALO sent to your wallet.</p>}
      </div>
    </main>
  );
}
