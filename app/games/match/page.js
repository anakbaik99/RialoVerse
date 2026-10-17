"use client";
import { useState, useEffect, useCallback } from "react";
import { useRialoWallet } from "../../providers";
import WalletMenu from "../../WalletMenu";

// ====== Rialo Testnet ======
const MATCH_PROGRAM = "3oo4MUjgm1gTCuTHwL8by3YZxKkaoSMsgpCrHUd2Rwjy";
const VAULT = "8M4338AUfz7Rqfs2GzpmZZsx5okAg2djCMeZPzsbqxKk";
const MIN_BET = 1;
const MAX_BET = 5;
const CHIPS = [1, 2, 3, 5];
const FEE_BUFFER = 0.01;
const MAX_MULT = 100;

// Urutan sama dengan program: 0 = R, 1 = V, 2 = diamond, 3 = star
const SYMS = [
  { ch: "R", name: "Rialo", img: "/spawn-logo.svg", color: "#d7ff1f", text: "#0a0a0a", pct: 40 },
  { ch: "V", name: "RialoVerse", img: "/logo.png", color: "#8b5cff", text: "#ffffff", pct: 30 },
  { ch: "◆", name: "Diamond", color: "#5fd0ff", text: "#0a0a0a", pct: 20 },
  { ch: "★", name: "Star", color: "#ffb85f", text: "#0a0a0a", pct: 10 },
];
const TRIPLE = [5, 10, 25, 100];
const PAIR = 0.15;

function Sym({ s, size }) {
  if (s.img) return <img src={s.img} alt={s.name} width={size} height={size} draggable={false} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />;
  return <span style={{ fontSize: size * 0.95, lineHeight: 1 }}>{s.ch}</span>;
}

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

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function toBase58(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = "";
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = "1" + s; else break; }
  return s;
}
const sigKey = (s) => (typeof s.signature === "string" ? s.signature : toBase58(Uint8Array.from(s.signature)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n, d = 2) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d });

function timeAgo(t0) {
  if (!t0) return "";
  let t = Number(t0);
  if (t > 1e17) t = t / 1e9; else if (t > 1e14) t = t / 1e6; else if (t > 1e11) t = t / 1e3;
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - t));
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Baca hasil putaran dari log transaksi
async function readMatch(client, s) {
  try {
    const tx = await client.queryClient.call("getTransaction", [{ signature: s.signature }]);
    const line = (tx?.meta?.logMessages || []).find((l) => l.includes("match r1="));
    if (!line) return null;
    const m = line.match(/r1=(\d) r2=(\d) r3=(\d) bet=(\d+) payout=(\d+)/);
    if (!m) return null;
    return {
      sig: sigKey(s),
      r: [Number(m[1]), Number(m[2]), Number(m[3])],
      bet: Number(m[4]) / 1e9,
      payout: Number(m[5]) / 1e9,
      blockTime: s.blockTime ? Number(s.blockTime) : null,
    };
  } catch {
    return null;
  }
}

export default function TokenMatchPage() {
  const { address, isConnected, connect, signAndSend } = useRialoWallet();
  const [bet, setBet] = useState(1);
  const [balance, setBalance] = useState(0);
  const [pool, setPool] = useState(0);
  const [history, setHistory] = useState([]);
  const [reels, setReels] = useState({ v: [3, 0, 1], lock: [true, true, true] });
  const [phase, setPhase] = useState("idle"); // idle | signing | waiting | revealing
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  // gulungan yang belum terkunci berputar acak
  useEffect(() => {
    if (reels.lock.every(Boolean)) return;
    const t = setInterval(() => {
      setReels((r) => ({ ...r, v: r.v.map((x, i) => (r.lock[i] ? x : Math.floor(Math.random() * 4))) }));
    }, 90);
    return () => clearInterval(t);
  }, [reels.lock]);

  const refresh = useCallback(async () => {
    try {
      const { cdk, client } = await loadCdk();
      const P = (s) => cdk.PublicKey.fromString(s);
      try { setPool(Number(BigInt(await client.getBalance(P(VAULT)))) / 1e9); } catch {}
      if (address) {
        const owner = P(address);
        try { setBalance(Number(BigInt(await client.getBalance(owner))) / 1e9); } catch {}
        try {
          const sigs = await client.getSignaturesForAddress(owner, { limit: 15 });
          const rows = (await Promise.all(sigs.map((s) => readMatch(client, s)))).filter(Boolean);
          setHistory(rows);
        } catch {}
      } else {
        setBalance(0);
        setHistory([]);
      }
    } catch {}
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  const busy = phase !== "idle";
  const insufficient = bet > balance - FEE_BUFFER;
  const vaultLow = pool + bet < bet * MAX_MULT;

  async function handleSpin() {
    setErrorMsg("");
    setResult(null);
    if (bet < MIN_BET || bet > MAX_BET) { setErrorMsg(`Bet must be between ${MIN_BET} and ${MAX_BET} RIALO.`); return; }
    if (insufficient) { setErrorMsg("Insufficient balance."); return; }
    if (vaultLow) { setErrorMsg("The vault is too low to cover this bet. Try a smaller bet."); return; }
    setPhase("signing");
    try {
      const { cdk, client } = await loadCdk();
      const P = (s) => cdk.PublicKey.fromString(s);
      const A = (k, w, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
      const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
      const owner = P(address);

      const data = new Uint8Array(16);
      const dv = new DataView(data.buffer);
      dv.setBigUint64(0, BigInt(Math.round(bet * 1e9)), true);
      dv.setBigUint64(8, BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)), true);

      const ix = { programId: P(MATCH_PROGRAM), data, accounts: [A(owner, true, true), A(P(VAULT), true), A(sys, false)] };
      const tx = cdk.TransactionBuilder.create()
        .setPayer(owner)
        .setValidFrom(BigInt(Date.now()))
        .setConfigHashPrefix(await client.getConfigHashPrefix())
        .addInstruction(ix)
        .build();

      const before = (await client.getSignaturesForAddress(owner, { limit: 1 }))[0];
      const beforeKey = before ? sigKey(before) : null;

      await signAndSend(tx.serialize());
      setPhase("waiting");
      setReels((r) => ({ ...r, lock: [false, false, false] }));

      let found = null;
      for (let i = 0; i < 20 && !found; i++) {
        await sleep(1500);
        const sigs = await client.getSignaturesForAddress(owner, { limit: 3 });
        for (const s of sigs) {
          if (sigKey(s) === beforeKey) break;
          const info = await readMatch(client, s);
          if (info) { found = info; break; }
        }
      }
      if (!found) throw new Error("Spin sent, but the result is not available yet. Check Recent Spins in a moment.");

      // gulungan berhenti satu per satu
      setPhase("revealing");
      for (let i = 0; i < 3; i++) {
        await sleep(650);
        setReels((r) => ({
          v: r.v.map((x, j) => (j === i ? found.r[i] : x)),
          lock: r.lock.map((l, j) => (j === i ? true : l)),
        }));
      }
      await sleep(400);
      setResult(found);
      setPhase("idle");
      refresh();
    } catch (e) {
      setReels((r) => ({ ...r, lock: [true, true, true] }));
      setErrorMsg(String(e?.message || e).slice(0, 200));
      setPhase("idle");
    }
  }

  const buttonLabel = !isConnected ? "Connect Wallet"
    : phase === "signing" ? "Confirm in wallet..."
    : phase === "waiting" ? "Spinning on-chain..."
    : phase === "revealing" ? "Revealing..."
    : `SPIN ${fmt(bet, 2)} RIALO`;

  const panel = { width: "100%", maxWidth: 420, background: "#0e0f16", border: "1px solid #2a2b3a", borderRadius: 18, padding: 20, boxSizing: "border-box" };
  const muted = { color: "#8a8b9c" };
  const sym = (i) => SYMS[i];
  const trip = result && result.r[0] === result.r[1] && result.r[1] === result.r[2];
  const pair = result && !trip && (result.r[0] === result.r[1] || result.r[1] === result.r[2] || result.r[0] === result.r[2]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 16, background: "radial-gradient(circle at 50% 0%, #2a1a05 0%, #0a0a0a 55%)", color: "#fff", boxSizing: "border-box", gap: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <a href="/games" style={{ textDecoration: "none", fontWeight: 700 }}><span style={{ color: "#fff" }}>← Rialo</span><span style={{ color: "#d7ff1f" }}>Verse</span></a>
        <h2 style={{ margin: 0, fontSize: 20 }}>Token Match</h2>
      </div>

      {/* REELS */}
      <div style={{ ...panel, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 11, letterSpacing: 1, ...muted }}>RIALO TESTNET</span>
          {isConnected && <WalletMenu />}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "6px 0 18px" }}>
          {reels.v.map((v, i) => {
            const s = sym(v);
            const on = reels.lock[i];
            return (
              <div key={i} style={{ width: 92, height: 112, borderRadius: 16, background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", border: `3px solid ${on ? s.color : "#2a2b3a"}`, boxShadow: on ? `0 0 26px ${s.color}55, inset 0 0 18px ${s.color}22` : "none", color: s.color, fontSize: 60, fontWeight: 900, textShadow: `0 0 16px ${s.color}`, transition: "border-color .2s, box-shadow .2s", opacity: on ? 1 : 0.8 }}>
                <Sym s={s} size={64} />
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 13, margin: 0, ...muted }}>Vault: <span style={{ color: "#fff", fontWeight: 600 }}>{fmt(pool, 2)} RIALO</span> · up to {MAX_MULT}x</p>
      </div>

      {/* BET */}
      <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, ...muted }}>
          <span style={{ letterSpacing: 1 }}>BET (RIALO)</span>
          <span>Balance: {fmt(balance, 4)}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {CHIPS.map((c) => (
            <button key={c} disabled={busy} onClick={() => setBet(c)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 999, cursor: busy ? "not-allowed" : "pointer", border: `2px solid ${bet === c ? "#ffb85f" : "#2a2b3a"}`, background: bet === c ? "#ffb85f" : "#0a0a0a", color: bet === c ? "#0a0a0a" : "#fff", fontWeight: 800, fontSize: 14 }}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={!isConnected ? connect : handleSpin} disabled={busy}
          className={busy ? "tm-pulsing" : ""}
          style={{ width: "100%", padding: 14, borderRadius: 14, background: busy ? "#333" : "#ffb85f", color: busy ? "#888" : "#0a0a0a", border: "none", fontWeight: 800, fontSize: 15, cursor: busy ? "not-allowed" : "pointer" }}>
          {buttonLabel}
        </button>
        {errorMsg && <p style={{ color: "#ff4d4d", marginTop: 12, textAlign: "center", fontSize: 13, wordBreak: "break-word" }}>{errorMsg}</p>}
        {result && (
          <p style={{ marginTop: 12, fontSize: 15, fontWeight: 800, textAlign: "center", color: result.payout > result.bet ? "#d7ff1f" : pair ? "#ffb85f" : "#ff7a8a" }}>
            {trip ? `3x ${sym(result.r[0]).name} MATCH — you won ${fmt(result.payout, 4)} RIALO!`
              : pair ? `Pair — ${fmt(result.payout, 4)} RIALO back`
              : "No match — better luck next time"}
          </p>
        )}
      </div>

      {/* PAYTABLE */}
      <div style={panel}>
        <h3 style={{ fontSize: 13, letterSpacing: 1, margin: "0 0 10px", textTransform: "uppercase", ...muted }}>Payouts</h3>
        {[3, 2, 1, 0].map((i, k) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: k ? "1px solid #2a2b3a" : "none", fontSize: 14 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: SYMS[i].color, letterSpacing: 2 }}><Sym s={SYMS[i]} size={22} /><Sym s={SYMS[i]} size={22} /><Sym s={SYMS[i]} size={22} /></span>
            <span style={{ fontWeight: 700 }}>{TRIPLE[i]}x</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #2a2b3a", fontSize: 14 }}>
          <span style={{ ...muted }}>Any two the same</span>
          <span style={{ fontWeight: 700 }}>{PAIR}x</span>
        </div>
      </div>

      {/* HISTORY */}
      <div style={{ ...panel, marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, letterSpacing: 1, margin: "0 0 10px", textTransform: "uppercase", ...muted }}>Your Recent Spins</h3>
        {!isConnected && <p style={{ fontSize: 13, margin: 0, ...muted }}>Connect your wallet to see your spin history.</p>}
        {isConnected && history.length === 0 && <p style={{ fontSize: 13, margin: 0, ...muted }}>No spins yet.</p>}
        {history.map((h, i) => (
          <a key={h.sig} href={`https://rialo-explorer-testnet-direct.vercel.app/txs/${h.sig}`} target="_blank" rel="noreferrer"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i ? "1px solid #2a2b3a" : "none", textDecoration: "none", color: "inherit" }}>
            <span style={{ display: "flex", gap: 6 }}>
              {h.r.map((v, j) => (
                <i key={j} style={{ width: 24, height: 24, borderRadius: 7, background: SYMS[v].color, color: SYMS[v].text, display: "inline-flex", alignItems: "center", justifyContent: "center", fontStyle: "normal", fontSize: 13, fontWeight: 900 }}><Sym s={SYMS[v]} size={16} /></i>
              ))}
            </span>
            <span style={{ textAlign: "right", fontSize: 12 }}>
              <div style={{ color: h.payout > h.bet ? "#d7ff1f" : "#ff7a8a", fontWeight: 700, fontSize: 13 }}>
                {h.payout - h.bet > 0 ? "+" : "-"}{fmt(Math.abs(h.payout - h.bet), 4)} RIALO
              </div>
              <div style={muted}>bet {fmt(h.bet, 2)} • {timeAgo(h.blockTime)}</div>
            </span>
          </a>
        ))}
      </div>

      <style>{`
        @keyframes tmPulse { 0% { opacity: 1; } 50% { opacity: 0.55; } 100% { opacity: 1; } }
        .tm-pulsing { animation: tmPulse 1.1s ease-in-out infinite; }
      `}</style>
    </main>
  );
}
