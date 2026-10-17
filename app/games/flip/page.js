"use client";
import { useState, useEffect, useCallback } from "react";
import { useRialoWallet } from "../../providers";
import WalletMenu from "../../WalletMenu";

// ====== Rialo Testnet ======
const FLIP_PROGRAM = "2rtGH7kCYcE7uRRt6C2KtsCfnbi7Sa29Ki9vMJhNtaix";
const VAULT = "Bvq1p8nTqi7c36uETrAGMPyg5vwYED79fPacQfsyUCLW";
const MIN_BET = 1;
const MAX_BET = 25;
const CHIPS = [1, 2, 5, 10, 25];
const FEE_BUFFER = 0.01;

// 0 = Heads (R), 1 = Tails (V) - sama dengan program
const SIDES = [
  { id: 0, name: "HEADS", letter: "R", img: "/spawn-logo.svg", color: "#d7ff1f", text: "#0a0a0a" },
  { id: 1, name: "TAILS", letter: "V", img: "/logo.png", color: "#8b5cff", text: "#ffffff" },
];

function Logo({ s, size }) {
  return <img src={s.img} alt={s.name} width={size} height={size} draggable={false} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />;
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

// Baca hasil lemparan dari log transaksi
async function readFlip(client, s) {
  try {
    const tx = await client.queryClient.call("getTransaction", [{ signature: s.signature }]);
    const line = (tx?.meta?.logMessages || []).find((l) => l.includes("flip choice="));
    if (!line) return null;
    const m = line.match(/choice=(\d+) result=(\d+) bet=(\d+) payout=(\d+)/);
    if (!m) return null;
    return {
      sig: sigKey(s),
      choice: Number(m[1]),
      result: Number(m[2]),
      bet: Number(m[3]) / 1e9,
      payout: Number(m[4]) / 1e9,
      blockTime: s.blockTime ? Number(s.blockTime) : null,
    };
  } catch {
    return null;
  }
}

export default function RialoFlipPage() {
  const { address, isConnected, connect, signAndSend } = useRialoWallet();
  const [side, setSide] = useState(0);
  const [bet, setBet] = useState(1);
  const [balance, setBalance] = useState(0);
  const [pool, setPool] = useState(0);
  const [history, setHistory] = useState([]);
  const [rot, setRot] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | signing | waiting | flipping
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
          const rows = (await Promise.all(sigs.map((s) => readFlip(client, s)))).filter(Boolean);
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
  const vaultLow = pool < bet;

  async function handleFlip() {
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

      const data = new Uint8Array(17);
      const dv = new DataView(data.buffer);
      dv.setBigUint64(0, BigInt(Math.round(bet * 1e9)), true);
      dv.setBigUint64(8, BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)), true);
      data[16] = side;

      const ix = { programId: P(FLIP_PROGRAM), data, accounts: [A(owner, true, true), A(P(VAULT), true), A(sys, false)] };
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

      let found = null;
      for (let i = 0; i < 20 && !found; i++) {
        await sleep(1500);
        const sigs = await client.getSignaturesForAddress(owner, { limit: 3 });
        for (const s of sigs) {
          if (sigKey(s) === beforeKey) break;
          const info = await readFlip(client, s);
          if (info) { found = info; break; }
        }
      }
      if (!found) throw new Error("Flip sent, but the result is not available yet. Check Recent Flips in a moment.");

      // animasi koin berhenti di sisi hasil
      setPhase("flipping");
      const want = found.result === 0 ? 0 : 180;
      const cur = ((rot % 360) + 360) % 360;
      const delta = (want - cur + 360) % 360;
      setRot(rot + 4 * 360 + delta);
      await sleep(2400);
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
    : phase === "waiting" ? "Flipping on-chain..."
    : phase === "flipping" ? "Flipping..."
    : `FLIP ${fmt(bet, 2)} RIALO · ${SIDES[side].name}`;

  const panel = { width: "100%", maxWidth: 420, background: "#0e0f16", border: "1px solid #2a2b3a", borderRadius: 18, padding: 20, boxSizing: "border-box" };
  const muted = { color: "#8a8b9c" };
  const face = (s, back) => ({
    position: "absolute", inset: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: `radial-gradient(circle at 35% 30%, ${s.color}, ${s.color}aa 70%, #0a0a0a 150%)`,
    border: "6px solid rgba(255,255,255,0.22)", boxShadow: `0 0 44px ${s.color}66, inset 0 0 26px rgba(0,0,0,0.35)`,
    color: s.text, fontSize: 86, fontWeight: 900, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
    transform: back ? "rotateY(180deg)" : "none",
  });
  const won = result && result.payout > 0;

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 16, background: "radial-gradient(circle at 50% 0%, #1a1030 0%, #0a0a0a 55%)", color: "#fff", boxSizing: "border-box", gap: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <a href="/games" style={{ textDecoration: "none", fontWeight: 700 }}><span style={{ color: "#fff" }}>← Rialo</span><span style={{ color: "#d7ff1f" }}>Verse</span></a>
        <h2 style={{ margin: 0, fontSize: 20 }}>Rialo Flip</h2>
      </div>

      {/* COIN */}
      <div style={{ ...panel, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, letterSpacing: 1, ...muted }}>RIALO TESTNET</span>
          {isConnected && <WalletMenu />}
        </div>
        <div style={{ perspective: 900, display: "flex", justifyContent: "center", margin: "14px 0 18px" }}>
          <div className={phase === "signing" || phase === "waiting" ? "flip-bob" : ""} style={{ width: 170, height: 170 }}>
            <div style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d", transform: `rotateY(${rot}deg)`, transition: phase === "flipping" ? "transform 2.3s cubic-bezier(0.2, 0.7, 0.2, 1)" : "none" }}>
              <div style={face(SIDES[0], false)}><Logo s={SIDES[0]} size={128} /></div>
              <div style={face(SIDES[1], true)}><Logo s={SIDES[1]} size={128} /></div>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, margin: 0, ...muted }}>Vault: <span style={{ color: "#fff", fontWeight: 600 }}>{fmt(pool, 2)} RIALO</span> · 2x payout on win</p>
      </div>

      {/* CONTROLS */}
      <div style={panel}>
        <div style={{ fontSize: 12, letterSpacing: 1, marginBottom: 8, ...muted }}>PICK A SIDE</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {SIDES.map((s) => {
            const on = side === s.id;
            return (
              <button key={s.id} disabled={busy} onClick={() => setSide(s.id)}
                style={{ flex: 1, padding: "12px 0", borderRadius: 14, cursor: busy ? "not-allowed" : "pointer", border: `2px solid ${on ? s.color : "#2a2b3a"}`, background: on ? `${s.color}22` : "#0a0a0a", color: on ? s.color : "#8a8b9c", fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}><Logo s={s} size={36} /></div>
                {s.name}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, ...muted }}>
          <span style={{ letterSpacing: 1 }}>BET (RIALO)</span>
          <span>Balance: {fmt(balance, 4)}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {CHIPS.map((c) => (
            <button key={c} disabled={busy} onClick={() => setBet(c)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 999, cursor: busy ? "not-allowed" : "pointer", border: `2px solid ${bet === c ? "#d7ff1f" : "#2a2b3a"}`, background: bet === c ? "#d7ff1f" : "#0a0a0a", color: bet === c ? "#0a0a0a" : "#fff", fontWeight: 800, fontSize: 14 }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, marginBottom: 16, ...muted }}>Win pays {fmt(bet * 2, 2)} RIALO (+{fmt(bet, 2)} profit) · Max bet {MAX_BET}</div>

        <button onClick={!isConnected ? connect : handleFlip} disabled={busy}
          className={busy ? "flip-pulsing" : ""}
          style={{ width: "100%", padding: 14, borderRadius: 14, background: busy ? "#333" : SIDES[side].color, color: busy ? "#888" : SIDES[side].text, border: "none", fontWeight: 800, fontSize: 15, cursor: busy ? "not-allowed" : "pointer" }}>
          {buttonLabel}
        </button>

        {errorMsg && <p style={{ color: "#ff4d4d", marginTop: 12, textAlign: "center", fontSize: 13, wordBreak: "break-word" }}>{errorMsg}</p>}
        {result && (
          <p style={{ marginTop: 12, fontSize: 15, fontWeight: 800, textAlign: "center", color: won ? "#d7ff1f" : "#ff7a8a" }}>
            {SIDES[result.result].name} — {won ? `you won ${fmt(result.payout, 4)} RIALO!` : "not this time"}
          </p>
        )}
      </div>

      {/* HISTORY */}
      <div style={{ ...panel, marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, letterSpacing: 1, margin: "0 0 10px", textTransform: "uppercase", ...muted }}>Your Recent Flips</h3>
        {!isConnected && <p style={{ fontSize: 13, margin: 0, ...muted }}>Connect your wallet to see your flip history.</p>}
        {isConnected && history.length === 0 && <p style={{ fontSize: 13, margin: 0, ...muted }}>No flips yet.</p>}
        {history.map((h, i) => (
          <a key={h.sig} href={`https://rialo-explorer-testnet-direct.vercel.app/txs/${h.sig}`} target="_blank" rel="noreferrer"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i ? "1px solid #2a2b3a" : "none", textDecoration: "none", color: "inherit" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 14 }}>
              <i style={{ width: 22, height: 22, borderRadius: "50%", background: SIDES[h.result].color, color: SIDES[h.result].text, display: "inline-flex", alignItems: "center", justifyContent: "center", fontStyle: "normal", fontSize: 12, fontWeight: 900 }}><Logo s={SIDES[h.result]} size={16} /></i>
              picked {SIDES[h.choice].name}
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
        @keyframes flipPulse { 0% { opacity: 1; } 50% { opacity: 0.55; } 100% { opacity: 1; } }
        .flip-pulsing { animation: flipPulse 1.1s ease-in-out infinite; }
        @keyframes flipBob { 0% { transform: translateY(0); } 50% { transform: translateY(-12px); } 100% { transform: translateY(0); } }
        .flip-bob { animation: flipBob 0.9s ease-in-out infinite; }
      `}</style>
    </main>
  );
}
