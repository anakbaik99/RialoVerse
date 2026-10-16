"use client";
import { useState, useEffect, useCallback } from "react";
import { useRialoWallet } from "../providers";

const KELVIN_PER_RLO = 1000000000n; // 1 RIALO = 1e9 kelvin
const EXPLORER_TX = "https://rialo-explorer-testnet-direct.vercel.app/txs/";

let cdkPromise;
function loadCdk() {
  if (!cdkPromise) {
    cdkPromise = import("@rialo/ts-cdk").then((cdk) => ({
      cdk,
      client: cdk.createRialoClient(cdk.getDefaultRialoClientConfig("testnet")),
    }));
  }
  return cdkPromise;
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

export default function FaucetPage() {
  const { address, isConnected, connect, disconnect } = useRialoWallet();
  const [balance, setBalance] = useState(null); // dalam kelvin (bigint)
  const [claimBusy, setClaimBusy] = useState(false);
  const [sig, setSig] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const claimDots = useAnimatedDots(claimBusy);

  const refresh = useCallback(async () => {
    if (!address) { setBalance(null); return; }
    try {
      const { cdk, client } = await loadCdk();
      setBalance(BigInt(await client.getBalance(cdk.PublicKey.fromString(address))));
    } catch {}
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleClaim() {
    setErrorMsg("");
    setSig("");
    setClaimBusy(true);
    try {
      const { cdk, client } = await loadCdk();
      const res = await client.requestAirdrop(cdk.PublicKey.fromString(address), KELVIN_PER_RLO);
      const s = typeof res === "string"
        ? res
        : toBase58(Uint8Array.from(res));
      setSig(s);
      setClaimBusy(false);
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        await refresh();
      }
    } catch (e) {
      setErrorMsg("Faucet failed: " + String(e?.message || e).slice(0, 200));
    } finally {
      setClaimBusy(false);
    }
  }

  const balanceLabel = balance === null ? "0" : (Number(balance) / 1e9).toFixed(4).replace(/\.?0+$/, "") || "0";
  const canClaim = isConnected && !claimBusy;

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#0a0a0a", boxSizing: "border-box" }}>
      <style>{`
        @keyframes rialoPulse { 0% { opacity: 1; } 50% { opacity: 0.55; } 100% { opacity: 1; } }
        .rialo-pulsing { animation: rialoPulse 1.1s ease-in-out infinite; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420, background: "#111218", borderRadius: 0, padding: 24, border: "2px solid #d7ff1f", boxShadow: "none", boxSizing: "border-box", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <a href="/" style={{ textDecoration: "none", fontWeight: 700 }}><span style={{ color: "#fff" }}>← Rialo</span><span style={{ color: "#d7ff1f" }}>Verse</span></a>
          <h2 style={{ margin: 0, fontSize: 20 }}>Faucet</h2>
        </div>

        {isConnected && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={disconnect} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999, border: "2px solid #d7ff1f", background: "#0a0a0a", color: "#d7ff1f", fontWeight: 600, cursor: "pointer" }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </button>
          </div>
        )}

        <div style={{ fontSize: 40, marginBottom: 8 }}>💧</div>
        <p style={{ color: "#8a8b9c", fontSize: 14, marginBottom: 20 }}>
          Claim free RIALO testnet tokens from the official Rialo faucet.
        </p>

        {address && (
          <div style={{ background: "#15161f", borderRadius: 0, padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#8a8b9c" }}>Your RIALO balance</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{balanceLabel} RIALO</div>
          </div>
        )}

        {!isConnected ? (
          <button onClick={connect} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#d7ff1f", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16 }}>
            Connect Wallet
          </button>
        ) : (
          <button onClick={handleClaim} disabled={!canClaim} className={claimBusy ? "rialo-pulsing" : ""} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#d7ff1f", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16, cursor: canClaim ? "pointer" : "not-allowed" }}>
            {claimBusy ? `Claiming${claimDots}` : "Claim RIALO"}
          </button>
        )}

        {errorMsg && <p style={{ color: "#ff4d4d", marginTop: 12, fontSize: 13, wordBreak: "break-all" }}>{errorMsg}</p>}
        {sig && (
          <p style={{ color: "green", marginTop: 12, fontSize: 13, wordBreak: "break-all" }}>
            Claim successful! ✅{" "}
            <a href={EXPLORER_TX + sig} target="_blank" rel="noreferrer" style={{ color: "#d7ff1f", textDecoration: "underline" }}>View transaction</a>
          </p>
        )}
      </div>
    </main>
  );
}

