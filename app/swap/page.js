"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRialoWallet } from "../providers";
import WalletMenu from "../WalletMenu";

// ====== Konfigurasi Rialo Testnet (pool RIALO <-> RVerse) ======
const AMM_PROGRAM = "D6py9TbbsCTPABZfgpexc8fHXTsDG2x9eJivfzyR7pDi";
const MINT = "7PrFhdj8oktWHXN7jvQHV2GBXjhFFYjH4rUEom1gZ5dz";
const POOL_PDA = "5DdJ1354CHMdzj533QgW8ytLvV9pQ4JRuCoL9sg9zkSj";
const VAULT_TOKEN = "ETx31zoDMa9DB247SZ7pQLms7AMRtRdmh38L2vwQFTFA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

const TOKENS = {
  RIALO: { decimals: 9, iconLetter: "R", iconBg: "#d7ff1f", iconColor: "#0a0a0a" },
  RVerse: { decimals: 6, iconLetter: "V", iconBg: "#7c5cff", iconColor: "#fff" },
};
const TOKEN_LIST = ["RIALO", "RVerse"];
const GAS_BUFFER = 10000000n; // 0,01 RIALO disisakan untuk biaya
const SLIPPAGE_OPTIONS = [50, 100, 300];

// ====== Helper ======
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

function toUnits(str, decimals) {
  if (!str || str === ".") return 0n;
  const [w, f = ""] = String(str).split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
}
function fromUnits(v, decimals) {
  const s = v.toString().padStart(decimals + 1, "0");
  const w = s.slice(0, -decimals);
  const f = s.slice(-decimals).replace(/0+$/, "");
  return f ? `${w}.${f}` : w;
}
// Sama dengan program: fee 0,3%
function quoteOut(amountIn, reserveIn, reserveOut) {
  if (!reserveIn || !reserveOut || amountIn <= 0n) return 0n;
  const inFee = amountIn * 997n;
  return (inFee * reserveOut) / (reserveIn * 1000n + inFee);
}

function TokenIcon({ token, size = 20 }) {
  const cfg = TOKENS[token];
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

export default function SwapPage() {
  const { address, isConnected, connect, disconnect, signAndSend, error: walletError } = useRialoWallet();

  const [fromToken, setFromToken] = useState("RIALO");
  const [toToken, setToToken] = useState("RVerse");
  const [amountIn, setAmountIn] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);
  const [reserves, setReserves] = useState({ rialo: 0n, token: 0n });
  const [balances, setBalances] = useState({ RIALO: 0n, RVerse: 0n });
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapStep, setSwapStep] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const swapDots = useAnimatedDots(swapBusy);

  // Isi awal dari tautan, mis. /swap?from=RIALO&to=RVerse&amount=0.01 (dipakai COMI)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const norm = (x) => TOKEN_LIST.find((k) => k.toLowerCase() === (x || "").toLowerCase());
    const f = norm(q.get("from")), t = norm(q.get("to")), a = q.get("amount");
    if (f && t && f !== t) { setFromToken(f); setToToken(t); }
    if (a && /^[0-9]*\.?[0-9]*$/.test(a)) setAmountIn(a);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { cdk, client } = await loadCdk();
      const P = (s) => cdk.PublicKey.fromString(s);
      const rialo = BigInt(await client.getBalance(P(POOL_PDA)));
      const tok = await client.getTokenAccountBalance(P(VAULT_TOKEN));
      setReserves({ rialo, token: toUnits(tok.uiAmountString, 6) });
      if (address) {
        const owner = P(address);
        let r = 0n, t = 0n;
        try { r = BigInt(await client.getBalance(owner)); } catch {}
        try {
          const [ata] = cdk.PublicKey.findProgramAddress([owner.toBytes(), P(TOKEN_2022).toBytes(), P(MINT).toBytes()], P(ATA_PROGRAM));
          t = toUnits((await client.getTokenAccountBalance(ata)).uiAmountString, 6);
        } catch {}
        setBalances({ RIALO: r, RVerse: t });
      } else {
        setBalances({ RIALO: 0n, RVerse: 0n });
      }
    } catch (e) {
      setErrorMsg("Could not load pool data: " + String(e?.message || e).slice(0, 120));
    }
  }, [address]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const fromDec = TOKENS[fromToken].decimals;
  const toDec = TOKENS[toToken].decimals;
  const amountInUnits = useMemo(() => toUnits(amountIn, fromDec), [amountIn, fromDec]);
  const [rIn, rOut] = fromToken === "RIALO" ? [reserves.rialo, reserves.token] : [reserves.token, reserves.rialo];
  const out = useMemo(() => quoteOut(amountInUnits, rIn, rOut), [amountInUnits, rIn, rOut]);
  const estimatedOut = fromUnits(out, toDec);

  const priceImpact = useMemo(() => {
    if (amountInUnits <= 0n || out <= 0n || !rIn || !rOut) return 0;
    const ideal = (Number(amountInUnits) * Number(rOut)) / Number(rIn);
    return Math.max(0, (1 - Number(out) / ideal) * 100);
  }, [amountInUnits, out, rIn, rOut]);
  const highImpact = priceImpact > 5;

  const balance = balances[fromToken];
  const insufficientBalance = amountInUnits > 0n && amountInUnits > balance;
  const buttonDisabled = swapBusy || amountInUnits <= 0n || out <= 0n || insufficientBalance;
  const currentBalanceLabel = formatNice(fromUnits(balance, fromDec));

  const selectFrom = (t) => { if (t === toToken) setToToken(fromToken); setFromToken(t); setAmountIn(""); };
  const selectTo = (t) => { if (t === fromToken) setFromToken(toToken); setToToken(t); setAmountIn(""); };
  const flip = () => { setFromToken(toToken); setToToken(fromToken); setAmountIn(""); };
  const setPercentage = (pct) => {
    let v = (balance * BigInt(pct)) / 100n;
    if (fromToken === "RIALO" && pct === 100) v = balance > GAS_BUFFER ? balance - GAS_BUFFER : 0n;
    setAmountIn(fromUnits(v, fromDec));
  };

  async function handleSwap() {
    setErrorMsg("");
    setSwapStep("idle");
    setSwapBusy(true);
    try {
      const { cdk, client } = await loadCdk();
      const P = (s) => cdk.PublicKey.fromString(s);
      const A = (k, w, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
      const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
      const owner = P(address);
      const [userAta] = cdk.PublicKey.findProgramAddress([owner.toBytes(), P(TOKEN_2022).toBytes(), P(MINT).toBytes()], P(ATA_PROGRAM));

      const tag = fromToken === "RVerse" ? 0 : 1; // 0 = RVerse -> RIALO, 1 = RIALO -> RVerse
      const minOut = (out * BigInt(10000 - slippageBps)) / 10000n;
      const data = new Uint8Array(17);
      const dv = new DataView(data.buffer);
      data[0] = tag;
      dv.setBigUint64(1, amountInUnits, true);
      dv.setBigUint64(9, minOut, true);

      const swapIx = {
        programId: P(AMM_PROGRAM), data,
        accounts: [A(owner, true, true), A(userAta, true), A(P(VAULT_TOKEN), true), A(P(MINT), false),
          A(P(POOL_PDA), true), A(P(TOKEN_2022), false), A(sys, false)],
      };

      let builder = cdk.TransactionBuilder.create()
        .setPayer(owner)
        .setValidFrom(BigInt(Date.now()))
        .setConfigHashPrefix(await client.getConfigHashPrefix());
      if (tag === 1) {
        // buat token account RVerse kalau belum ada (idempotent)
        builder = builder.addInstruction({
          programId: P(ATA_PROGRAM), data: new Uint8Array([1]),
          accounts: [A(owner, true, true), A(userAta, true), A(owner, false), A(P(MINT), false), A(sys, false), A(P(TOKEN_2022), false)],
        });
      }
      const tx = builder.addInstruction(swapIx).build();
      const bytes = tx.serialize(); // transaksi belum ditandatangani; ditandatangani oleh ekstensi

      await signAndSend(bytes);
      setSwapStep("done");
      setAmountIn("");
      setTimeout(refresh, 2500);
    } catch (e) {
      const m = String(e?.message || e);
      setErrorMsg(/Custom.{0,4}1\b/.test(m) ? "Price moved. Try a higher slippage." : m.slice(0, 200));
    } finally {
      setSwapBusy(false);
    }
  }

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
            <WalletMenu />
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
          <button onClick={flip} style={{ background: "#1a1b26", borderRadius: 0, border: "2px solid #d7ff1f", color: "#d7ff1f", fontSize: 18, width: 36, height: 36, cursor: "pointer" }}>⇅</button>
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

        {amountIn && Number(amountIn) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: highImpact ? "#ff4d4d" : "#8a8b9c", marginBottom: 14, padding: "0 2px" }}>
            <span>Price impact</span>
            <span style={{ fontWeight: highImpact ? 700 : 400 }}>{priceImpact.toFixed(2)}%{highImpact ? " ⚠️ High" : ""}</span>
          </div>
        )}

        {insufficientBalance && <p style={{ color: "#ff4d4d", fontSize: 13, textAlign: "center", marginBottom: 10 }}>Insufficient balance.</p>}

        {!isConnected ? (
          <button onClick={connect} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#d7ff1f", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16 }}>Connect Wallet</button>
        ) : (
          <button onClick={handleSwap} disabled={buttonDisabled} className={swapBusy ? "rialo-pulsing" : ""} style={{ width: "100%", padding: 14, borderRadius: 12, background: buttonDisabled ? "#333" : "#d7ff1f", color: buttonDisabled ? "#888" : "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16, cursor: buttonDisabled ? "not-allowed" : "pointer" }}>
            {swapBusy ? `Swapping${swapDots}` : "Swap"}
          </button>
        )}

        {errorMsg && <p style={{ color: "#ff4d4d", marginTop: 12, textAlign: "center", fontSize: 13 }}>{errorMsg}</p>}
        {walletError && !isConnected && <p style={{ color: "#ff4d4d", marginTop: 12, textAlign: "center", fontSize: 13 }}>{walletError}</p>}
        {swapStep === "done" && <p style={{ color: "green", marginTop: 12, textAlign: "center" }}>Swap successful! ✅</p>}
      </div>
    </main>
  );
}

