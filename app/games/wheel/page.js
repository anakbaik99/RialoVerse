"use client";
import { useState, useEffect, useCallback } from "react";
import { useRialoWallet } from "../../providers";

// ====== Rialo Testnet ======
const WHEEL_PROGRAM = "Hmd2pSRZM7q1j873kQQUfzBVLnDrV4sfhSK45FRMF5wZ";
const VAULT = "91F4BqqmGX1BZND25uySyRpLmUG5FMiiaQ9rXk8b5YsA";
const MIN_BET = 1;
const MAX_BET = 100;
const FEE_BUFFER = 0.01; // sisakan sedikit RIALO untuk biaya transaksi

// Urutan sama dengan program: 0 = 5x, 1 = 10x, 2 = 1.5x, 3 = LOSE, 4 = 2x
const SEGMENTS = [
  { label: "5x", pct: 8, color: "#f0b90b" },
  { label: "10x", pct: 2, color: "#fb923c" },
  { label: "1.5x", pct: 30, color: "#f87171" },
  { label: "LOSE", pct: 35, color: "#4b5563" },
  { label: "2x", pct: 25, color: "#60a5fa" },
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

  const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 32, padding: 28, boxSizing: "border-box", width: "100%", maxWidth: 520 };
  const quick = { flex: 1, padding: "14px 0", borderRadius: 18, border: "1px solid #e5e7eb", background: "#fafafa", color: "#0d9488", fontFamily: "ui-monospace, monospace", fontSize: 15, cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#111827", fontFamily: "system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');`}</style>

      <header style={{ background: "#000", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "Orbitron, system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: "#e8ffe8", textShadow: "0 0 12px #22ff55, 0 0 24px #22ff55" }}>Rialo Wheel</span>
        <a href="/games" style={{ background: "#1d9bf0", color: "#fff", padding: "14px 28px", borderRadius: 18, textDecoration: "none", fontSize: 20, boxShadow: "0 0 16px #1d9bf0" }}>Back</a>
      </header>

      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", gap: 28 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 44, fontWeight: 900, color: "#111a2e" }}>RIALO WHEEL</h1>
          <p style={{ margin: "14px 0 0", fontSize: 20, color: "#4b5563" }}>Spin to win on Rialo Testnet</p>
        </div>

        <div style={{ width: "100%", maxWidth: 520, display: "flex", justifyContent: "flex-end" }}>
          <span style={{ border: "1px solid #e5e7eb", background: "#f3f4f6", borderRadius: 999, padding: "16px 28px", fontFamily: "ui-monospace, monospace", color: "#6b7280", fontSize: 18 }}>
            {isConnected ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
          </span>
        </div>

        {/* BET */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#4b5563", fontSize: 20, marginBottom: 14 }}>
            <span>Bet Amount</span>
            <span>Balance: {fmt(balance, 4)} RIALO</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 24, padding: "18px 22px" }}>
            <input type="text" inputMode="decimal" placeholder="0.0" value={bet} disabled={busy}
              onChange={(e) => setBet(sanitizeDecimalInput(e.target.value))}
              style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", fontSize: 44, color: "#111827" }} />
            <span style={{ fontWeight: 700, fontSize: 22, color: "#1f2937" }}>RIALO</span>
          </div>
          <p style={{ color: "#6b7280", fontSize: 17, margin: "14px 0" }}>Min: {MIN_BET.toFixed(1)} RIALO • Max: {MAX_BET.toFixed(1)} RIALO</p>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {[1, 5, 10, 25].map((m) => (
              <button key={m} style={quick} disabled={busy} onClick={() => setBet(String(MIN_BET * m))}>{m}x min</button>
            ))}
          </div>
          <button style={{ ...quick, width: "100%", flex: "none", background: "#e6f4f1", border: "1px solid #99d6cc" }} disabled={busy}
            onClick={() => setBet(String(Math.floor(maxAllowed * 100) / 100))}>Max Bet</button>

          <button onClick={!isConnected ? connect : handleSpin} disabled={busy}
            style={{ width: "100%", marginTop: 28, padding: "24px 0", borderRadius: 28, border: "none", background: busy ? "#5eaaa0" : "#0d9488", color: "#0b1b2b", fontSize: 26, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
            {buttonLabel}
          </button>

          {errorMsg && <p style={{ color: "#dc2626", marginTop: 16, fontSize: 16, wordBreak: "break-word" }}>{errorMsg}</p>}
          {result && (
            <p style={{ marginTop: 16, fontSize: 20, fontWeight: 700, textAlign: "center", color: result.payout > 0 ? "#059669" : "#6b7280" }}>
              {result.payout > 0 ? `${SEGMENTS[result.seg].label} — you won ${fmt(result.payout, 4)} RIALO!` : "LOSE — better luck next time"}
            </p>
          )}

          <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 28, paddingTop: 22 }}>
            <div style={{ color: "#6b7280", fontWeight: 700, letterSpacing: 1, fontSize: 18, marginBottom: 14 }}>WHEEL SEGMENTS</div>
            {SEGMENTS.map((s) => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", fontSize: 22 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <i style={{ width: 22, height: 22, borderRadius: "50%", background: s.color, display: "inline-block" }} />{s.label}
                </span>
                <span style={{ color: "#4b5563" }}>{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* WHEEL */}
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 400, margin: "0 auto" }}>
            <div style={{ position: "absolute", left: "50%", top: -6, transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "20px solid transparent", borderRight: "20px solid transparent", borderTop: "34px solid #f97316", zIndex: 2 }} />
            <svg viewBox="0 0 400 400" style={{ width: "100%", display: "block", transform: `rotate(${rotation}deg)`, transition: phase === "spinning" ? "transform 4.5s cubic-bezier(0.12, 0.6, 0.1, 1)" : "none" }}>
              <circle cx="200" cy="200" r="198" fill="#131a17" />
              {SEGMENTS.map((s, i) => {
                const [lx, ly] = polar(i * 72 + 36, 120);
                return (
                  <g key={s.label}>
                    <path d={slicePath(i)} fill={s.color} />
                    <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="26" fontWeight="800" fill="#111" transform={`rotate(${i * 72 + 36 - 90} ${lx} ${ly})`}>{s.label}</text>
                  </g>
                );
              })}
            </svg>
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "17%", aspectRatio: "1", borderRadius: "50%", background: "#fff", border: "4px solid #0d9488", display: "flex", alignItems: "center", justifyContent: "center", color: "#0d9488", fontWeight: 800, fontSize: 18 }}>RIALO</div>
          </div>
          <p style={{ color: "#6b7280", fontSize: 18, marginTop: 24 }}>Pool balance: {fmt(pool, 2)} RIALO</p>
        </div>

        {/* HISTORY */}
        <div style={card}>
          <h3 style={{ margin: "0 0 18px", fontSize: 24 }}>Your Recent Spins</h3>
          {!isConnected && <p style={{ color: "#6b7280", fontSize: 18 }}>Connect your wallet to see your spin history.</p>}
          {isConnected && history.length === 0 && <p style={{ color: "#6b7280", fontSize: 18 }}>No spins yet.</p>}
          {history.map((h) => (
            <a key={h.sig} href={`https://rialo-explorer-testnet-direct.vercel.app/txs/${h.sig}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: "1px solid #f3f4f6", textDecoration: "none", color: "inherit" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 700, fontSize: 18 }}>
                <i style={{ width: 16, height: 16, borderRadius: "50%", background: SEGMENTS[h.seg]?.color, display: "inline-block" }} />
                {SEGMENTS[h.seg]?.label}
              </span>
              <span style={{ textAlign: "right", fontSize: 15 }}>
                <div style={{ color: h.payout > 0 ? "#059669" : "#6b7280", fontWeight: 700 }}>
                  {h.payout > 0 ? `+${fmt(h.payout - h.bet, 4)}` : `-${fmt(h.bet, 4)}`} RIALO
                </div>
                <div style={{ color: "#9ca3af" }}>bet {fmt(h.bet, 2)} • {timeAgo(h.blockTime)}</div>
              </span>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}

