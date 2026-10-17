"use client";
import { useState, useEffect, useCallback } from "react";
import { useRialoWallet } from "../../providers";
import WalletMenu from "../../WalletMenu";

// ====== Rialo Testnet ======
const WHEEL_PROGRAM = "Hmd2pSRZM7q1j873kQQUfzBVLnDrV4sfhSK45FRMF5wZ";
const VAULT = "91F4BqqmGX1BZND25uySyRpLmUG5FMiiaQ9rXk8b5YsA";
const MIN_BET = 1;
const MAX_BET = 100;
const FEE_BUFFER = 0.01; // sisakan sedikit RIALO untuk biaya transaksi

// Urutan sama dengan program: 0 = 5x, 1 = 10x, 2 = 1.5x, 3 = LOSE, 4 = 2x
const SEGMENTS = [
  { label: "5x", pct: 8, color: "#d7ff1f", text: "#0a0a0a" },
  { label: "10x", pct: 2, color: "#ffb85f", text: "#0a0a0a" },
  { label: "1.5x", pct: 30, color: "#5fd0ff", text: "#0a0a0a" },
  { label: "LOSE", pct: 35, color: "#2a2b3a", text: "#ffffff" },
  { label: "2x", pct: 25, color: "#ff5f7a", text: "#0a0a0a" },
];

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

function sanitizeDecimalInput(raw) {
  let v = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  return v;
}
const fmt = (n, d = 2) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d });

function timeAgo(unixSeconds) {
  if (!unixSeconds) return "";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - Number(unixSeconds)));
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Baca hasil spin dari log transaksi
async function readSpin(client, s) {
  try {
    const tx = await client.queryClient.call("getTransaction", [{ signature: s.signature }]);
    const line = (tx?.meta?.logMessages || []).find((l) => l.includes("wheel segment="));
    if (!line) return null;
    const m = line.match(/segment=(\d+) bet=(\d+) payout=(\d+)/);
    if (!m) return null;
    return {
      sig: sigKey(s),
      seg: Number(m[1]),
      bet: Number(m[2]) / 1e9,
      payout: Number(m[3]) / 1e9,
      blockTime: s.blockTime ? Number(s.blockTime) : null,
    };
  } catch {
    return null;
  }
}

const polar = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [200 + r * Math.sin(a), 200 - r * Math.cos(a)];
};
const slicePath = (i) => {
  const [x0, y0] = polar(i * 72, 180);
  const [x1, y1] = polar((i + 1) * 72, 180);
  return `M200 200 L${x0} ${y0} A180 180 0 0 1 ${x1} ${y1} Z`;
};

export default function RialoWheelPage() {
  const { address, isConnected, connect, signAndSend } = useRialoWallet();

  const [bet, setBet] = useState("");
  const [balance, setBalance] = useState(0);   // RIALO
  const [pool, setPool] = useState(0);         // RIALO di vault
  const [history, setHistory] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState("idle");  // idle | signing | waiting | spinning
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

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
          const rows = (await Promise.all(sigs.map((s) => readSpin(client, s)))).filter(Boolean);
          setHistory(rows);
        } catch {}
      } else {
        setBalance(0);
        setHistory([]);
      }
    } catch {}
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  const betNum = parseFloat(bet) || 0;
  const maxAllowed = Math.max(0, Math.min(MAX_BET, balance - FEE_BUFFER));
  const busy = phase !== "idle";
  const invalid = betNum < MIN_BET || betNum > MAX_BET;
  const insufficient = betNum > balance - FEE_BUFFER;

  async function handleSpin() {
    setErrorMsg("");
    setResult(null);
    if (invalid) { setErrorMsg(`Bet must be between ${MIN_BET} and ${MAX_BET} RIALO.`); return; }
    if (insufficient) { setErrorMsg("Insufficient balance."); return; }
    setPhase("signing");
    try {
      const { cdk, client } = await loadCdk();
      const P = (s) => cdk.PublicKey.fromString(s);
      const A = (k, w, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
      const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
      const owner = P(address);

      const data = new Uint8Array(16);
      const dv = new DataView(data.buffer);
      dv.setBigUint64(0, BigInt(Math.round(betNum * 1e9)), true);
      dv.setBigUint64(8, BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)), true);

      const ix = { programId: P(WHEEL_PROGRAM), data, accounts: [A(owner, true, true), A(P(VAULT), true), A(sys, false)] };
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

      // tunggu transaksi baru muncul, lalu baca hasilnya dari log
      let found = null;
      for (let i = 0; i < 20 && !found; i++) {
        await sleep(1500);
        const sigs = await client.getSignaturesForAddress(owner, { limit: 3 });
        for (const s of sigs) {
          if (sigKey(s) === beforeKey) break;
          const info = await readSpin(client, s);
          if (info) { found = info; break; }
        }
      }
      if (!found) throw new Error("Spin sent, but the result is not available yet. Check Recent Spins in a moment.");

      // animasi roda berhenti di segmen hasil
      setPhase("spinning");
      const target = -(found.seg * 72 + 36) + (Math.random() - 0.5) * 50;
      const cur = ((rotation % 360) + 360) % 360;
      const want = ((target % 360) + 360) % 360;
      const delta = (want - cur + 360) % 360;
      setRotation(rotation + 5 * 360 + delta);
      await sleep(4700);

      setResult(found);
      setPhase("idle");
      refresh();
    } catch (e) {
      setErrorMsg(String(e?.message || e).slice(0, 200));
      setPhase("idle");
    }
  }

  const buttonLabel = !isConnected ? "Connect Wallet"
    : phase === "signing" ? "Confirm in wallet..."
    : phase === "waiting" ? "Waiting for result..."
    : phase === "spinning" ? "Spinning..."
    : "SPIN";

  const panel = { width: "100%", maxWidth: 420, background: "#111218", border: "2px solid #d7ff1f", padding: 20, boxSizing: "border-box" };
  const panelDim = { ...panel, border: "2px solid #2a2b3a" };
  const quick = { flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "2px solid #2a2b3a", background: "#0a0a0a", color: "#d7ff1f", cursor: "pointer" };
  const muted = { color: "#8a8b9c" };

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 16, background: "#0a0a0a", color: "#fff", boxSizing: "border-box", gap: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <a href="/games" style={{ textDecoration: "none", fontWeight: 700 }}><span style={{ color: "#fff" }}>← Rialo</span><span style={{ color: "#d7ff1f" }}>Verse</span></a>
        <h2 style={{
  margin: 0,
  fontFamily: "var(--font-orbitron), sans-serif",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textShadow: "0 0 12px #d7ff1f44"
}}>Rialo Wheel</h2>
      </div>

      {/* WHEEL */}
      <div style={{ ...panel, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 11, letterSpacing: 1, ...muted }}>RIALO TESTNET</span>
          {isConnected && (
            <WalletMenu />
          )}
        </div>

        <div style={{ position: "relative", width: "100%", maxWidth: 340, margin: "0 auto" }}>
          <div style={{ position: "absolute", left: "50%", top: -8, transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderTop: "24px solid #fff", zIndex: 2, filter: "drop-shadow(0 0 6px #d7ff1f)" }} />
          <svg viewBox="0 0 400 400" style={{ width: "100%", display: "block", transform: `rotate(${rotation}deg)`, transition: phase === "spinning" ? "transform 4.5s cubic-bezier(0.12, 0.6, 0.1, 1)" : "none" }}>
            <circle cx="200" cy="200" r="197" fill="#0a0a0a" stroke="#d7ff1f" strokeWidth="4" />
            {SEGMENTS.map((s, i) => {
              const [lx, ly] = polar(i * 72 + 36, 122);
              return (
                <g key={s.label}>
                  <path d={slicePath(i)} fill={s.color} stroke="#0a0a0a" strokeWidth="3" />
                  <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="26" fontWeight="800" fill={s.text} transform={`rotate(${i * 72 + 36 - 90} ${lx} ${ly})`}>{s.label}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "24%", aspectRatio: "1", borderRadius: "50%", background: "#0a0a0a", border: "3px solid #d7ff1f", display: "flex", alignItems: "center", justifyContent: "center", color: "#d7ff1f", fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>RIALO</div>
        </div>

        <p style={{ fontSize: 13, marginTop: 18, marginBottom: 0, ...muted }}>Pool balance: <span style={{ color: "#fff", fontWeight: 600 }}>{fmt(pool, 2)} RIALO</span></p>
      </div>

      {/* BET */}
      <div style={panel}>
        <div style={{ background: "#15161f", padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, ...muted }}>
            <label>Bet Amount</label>
            <span>Balance: {fmt(balance, 4)} RIALO</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, minWidth: 0 }}>
            <input type="text" inputMode="decimal" placeholder="0.0" value={bet} disabled={busy}
              onChange={(e) => setBet(sanitizeDecimalInput(e.target.value))}
              style={{ flex: "1 1 0%", minWidth: 0, width: 0, border: "none", background: "transparent", fontSize: 22, outline: "none", color: "#fff" }} />
            <span style={{ background: "#0a0a0a", border: "2px solid #2a2b3a", padding: "6px 10px", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>RIALO</span>
          </div>
          <div style={{ fontSize: 11, marginTop: 8, ...muted }}>Min {MIN_BET} • Max {MAX_BET} RIALO</div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {[1, 5, 10, 25].map((m) => (
            <button key={m} style={quick} disabled={busy} onClick={() => setBet(String(MIN_BET * m))}>{m}x min</button>
          ))}
        </div>
        <button style={{ ...quick, width: "100%", flex: "none", marginBottom: 14 }} disabled={busy}
          onClick={() => setBet(String(Math.floor(maxAllowed * 100) / 100))}>MAX BET</button>

        <button onClick={!isConnected ? connect : handleSpin} disabled={busy}
          className={busy ? "rialo-pulsing" : ""}
          style={{ width: "100%", padding: 14, borderRadius: 12, background: busy ? "#333" : "#d7ff1f", color: busy ? "#888" : "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16, cursor: busy ? "not-allowed" : "pointer" }}>
          {buttonLabel}
        </button>

        {errorMsg && <p style={{ color: "#ff4d4d", marginTop: 12, textAlign: "center", fontSize: 13, wordBreak: "break-word" }}>{errorMsg}</p>}
        {result && (
          <p style={{ marginTop: 12, fontSize: 15, fontWeight: 700, textAlign: "center", color: result.payout > 0 ? "#d7ff1f" : "#8a8b9c" }}>
            {result.payout > 0 ? `${SEGMENTS[result.seg].label} — you won ${fmt(result.payout, 4)} RIALO!` : "LOSE — better luck next time"}
          </p>
        )}
      </div>

      {/* SEGMENTS */}
      <div style={panelDim}>
        <h3 style={{ fontSize: 13, letterSpacing: 1, margin: "0 0 10px", textTransform: "uppercase", ...muted }}>Wheel Segments</h3>
        {SEGMENTS.map((s, i) => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: i ? "1px solid #2a2b3a" : "none", fontSize: 14 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
              <i style={{ width: 12, height: 12, borderRadius: "50%", background: s.color, display: "inline-block", border: "1px solid #3a3b4a" }} />{s.label}
            </span>
            <span style={muted}>{s.pct}%</span>
          </div>
        ))}
      </div>

      {/* HISTORY */}
      <div style={{ ...panelDim, marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, letterSpacing: 1, margin: "0 0 10px", textTransform: "uppercase", ...muted }}>Your Recent Spins</h3>
        {!isConnected && <p style={{ fontSize: 13, margin: 0, ...muted }}>Connect your wallet to see your spin history.</p>}
        {isConnected && history.length === 0 && <p style={{ fontSize: 13, margin: 0, ...muted }}>No spins yet.</p>}
        {history.map((h, i) => (
          <a key={h.sig} href={`https://rialo-explorer-testnet-direct.vercel.app/txs/${h.sig}`} target="_blank" rel="noreferrer"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i ? "1px solid #2a2b3a" : "none", textDecoration: "none", color: "inherit" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 14 }}>
              <i style={{ width: 12, height: 12, borderRadius: "50%", background: SEGMENTS[h.seg]?.color, display: "inline-block", border: "1px solid #3a3b4a" }} />
              {SEGMENTS[h.seg]?.label}
            </span>
            <span style={{ textAlign: "right", fontSize: 12 }}>
              <div style={{ color: h.payout > 0 ? "#d7ff1f" : "#8a8b9c", fontWeight: 700, fontSize: 13 }}>
                {h.payout > 0 ? `+${fmt(h.payout - h.bet, 4)}` : `-${fmt(h.bet, 4)}`} RIALO
              </div>
              <div style={muted}>bet {fmt(h.bet, 2)} • {timeAgo(h.blockTime)}</div>
            </span>
          </a>
        ))}
      </div>

      <style>{`
        @keyframes rialoPulse { 0% { opacity: 1; } 50% { opacity: 0.55; } 100% { opacity: 1; } }
        .rialo-pulsing { animation: rialoPulse 1.1s ease-in-out infinite; }
      `}</style>
    </main>
  );
}

