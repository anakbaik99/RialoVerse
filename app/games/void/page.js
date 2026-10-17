"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRialoWallet } from "../../providers";
import WalletMenu from "../../WalletMenu";

// ====== Rialo Testnet ======
const VOID_PROGRAM = "DucGg1UZkeRsSbA3mK8fmSLxKApZ5pYTNjNQsfDFDfmP";
const VAULT = "HemDytSMRoZsNndJ3QdEEKmaFLGUgtCH6yUap7j2YXLx";
const MIN_BET = 1;
const MAX_BET = 100;
const FEE_BUFFER = 0.02;
const MAX_PAYOUT = 1000;
const EXPLORER_TX = "https://rialo-explorer-testnet-direct.vercel.app/txs/";

// Papan tanpa batas. Petak baris r = 3 + mix(seed + r) % 5, seed diacak program saat start.
// Pengali kumulatif = 0.95 * prod(n / (n - 1)) (sama dengan program).
const M64 = (1n << 64n) - 1n;
function mixBig(z) {
  z = (z + 0x9E3779B97F4A7C15n) & M64;
  z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & M64;
  z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & M64;
  return z ^ (z >> 31n);
}
function tilesFor(seed, row) {
  if (seed == null) return 3;
  return Number(3n + (mixBig((seed + BigInt(row)) & M64) % 5n));
}
function buildRows(seed, count) {
  let m = 950000n;
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = tilesFor(seed, i);
    m = (m * BigInt(n)) / BigInt(n - 1);
    out.push({ n, mult: Number(m) / 1e6 });
  }
  return out;
}
const fmtMult = (x) => (Math.floor(x * 100 + 1e-9) / 100).toFixed(2);

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

function sanitizeDecimalInput(raw) {
  let v = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  return v;
}

// Baca hasil aksi dari log transaksi
async function readVoid(client, s) {
  try {
    const tx = await client.queryClient.call("getTransaction", [{ signature: s.signature }]);
    if (tx?.meta?.err) return { failed: true };
    const line = (tx?.meta?.logMessages || []).find((l) => l.includes("void:"));
    if (!line) return null;
    const t = line.slice(line.indexOf("void:"));
    const num = (k) => { const m = t.match(new RegExp("\\b" + k + "=(\\d+)")); return m ? Number(m[1]) : null; };
    return {
      kind: t.split(" ")[0].slice(5),
      row: num("row"), tile: num("tile"), voidIdx: num("void"), step: num("step"),
      bet: num("bet") != null ? num("bet") / 1e9 : null,
      payout: num("payout") != null ? num("payout") / 1e9 : null,
    };
  } catch {
    return null;
  }
}

export default function VoidRunPage() {
  const { address, isConnected, connect, signAndSend } = useRialoWallet();

  const [bet, setBet] = useState("");
  const [balance, setBalance] = useState(0);
  const [pool, setPool] = useState(0);
  const [run, setRun] = useState({ active: 0, step: 0, bet: 0, mult: 0 });
  const [seed, setSeed] = useState(null);
  const [trail, setTrail] = useState({});     // row -> { picked, voidIdx }
  const [ended, setEnded] = useState(null);   // { type: hit|win|cash, ... }
  const [phase, setPhase] = useState("idle"); // idle | signing | waiting
  const [errorMsg, setErrorMsg] = useState("");

  const loadState = useCallback(async () => {
    try {
      const { cdk, client } = await loadCdk();
      const P = (s) => cdk.PublicKey.fromString(s);
      try { setPool(Number(BigInt(await client.getBalance(P(VAULT)))) / 1e9); } catch {}
      if (!address) { setBalance(0); setRun({ active: 0, step: 0, bet: 0, mult: 0 }); return; }
      const owner = P(address);
      try { setBalance(Number(BigInt(await client.getBalance(owner))) / 1e9); } catch {}
      const [runPda] = cdk.PublicKey.findProgramAddress([new TextEncoder().encode("run"), owner.toBytes()], P(VOID_PROGRAM));
      let st = { active: 0, step: 0, bet: 0, mult: 0 };
      try {
        const a = await client.getAccountInfo(runPda);
        if (a) {
          const d = Uint8Array.from(atob(a.data[0]), (c) => c.charCodeAt(0));
          const dv = new DataView(d.buffer);
          st = { active: d[0], step: d[1], bet: Number(dv.getBigUint64(8, true)) / 1e9, mult: 0 };
          if (d.length >= 32) {
            setSeed(dv.getBigUint64(16, true));
            st.mult = Number(dv.getBigUint64(24, true)) / 1e6;
          }
        }
      } catch {}
      setRun(st);
    } catch {}
  }, [address]);

  useEffect(() => { loadState(); }, [loadState]);

  const [history, setHistory] = useState([]);
  const histCache = useRef(new Map());

  // History dibaca dari transaksi on-chain di akun run pemain
  const loadHistory = useCallback(async () => {
    if (!address) { setHistory([]); return; }
    try {
      const { cdk, client } = await loadCdk();
      const P = (s) => cdk.PublicKey.fromString(s);
      const owner = P(address);
      const [runPda] = cdk.PublicKey.findProgramAddress([new TextEncoder().encode("run"), owner.toBytes()], P(VOID_PROGRAM));
      const sigs = await client.getSignaturesForAddress(runPda, { limit: 40 });
      const infos = await Promise.all(sigs.map(async (s) => {
        const k = sigKey(s);
        if (histCache.current.has(k)) return histCache.current.get(k);
        const raw = await readVoid(client, s);
        const info = raw ? { ...raw, sig: k } : raw;
        if (info) histCache.current.set(k, info);
        return info;
      }));
      const list = infos.filter((i) => i && !i.failed).reverse();
      const runs = [];
      let cur = null;
      for (const i of list) {
        if (i.kind === "start") cur = { bet: i.bet };
        else if (i.kind === "hit") { runs.push({ sig: i.sig, win: false, bet: i.bet, payout: 0, rows: i.row + 1 }); cur = null; }
        else if (i.kind === "cashout") { runs.push({ sig: i.sig, win: true, bet: cur ? cur.bet : null, payout: i.payout, rows: i.step }); cur = null; }
        else if (i.kind === "win") { runs.push({ sig: i.sig, win: true, bet: cur ? cur.bet : null, payout: i.payout, rows: i.row + 1 }); cur = null; }
      }
      setHistory(runs.reverse().slice(0, 10));
    } catch {}
  }, [address]);

  // muat ulang history tiap aksi selesai
  useEffect(() => { if (phase === "idle") loadHistory(); }, [phase, loadHistory]);


  // Kirim satu aksi ke program, lalu baca hasilnya dari log
  async function doAction(data) {
    const { cdk, client } = await loadCdk();
    const P = (s) => cdk.PublicKey.fromString(s);
    const A = (k, w, s = false) => ({ pubkey: k, isSigner: s, isWritable: w });
    const sys = typeof cdk.SYSTEM_PROGRAM_ID === "string" ? P(cdk.SYSTEM_PROGRAM_ID) : cdk.SYSTEM_PROGRAM_ID;
    const owner = P(address);
    const [runPda] = cdk.PublicKey.findProgramAddress([new TextEncoder().encode("run"), owner.toBytes()], P(VOID_PROGRAM));

    const ix = { programId: P(VOID_PROGRAM), data, accounts: [A(owner, true, true), A(P(VAULT), true), A(runPda, true), A(sys, false)] };
    const tx = cdk.TransactionBuilder.create()
      .setPayer(owner)
      .setValidFrom(BigInt(Date.now()))
      .setConfigHashPrefix(await client.getConfigHashPrefix())
      .addInstruction(ix)
      .build();

    const before = (await client.getSignaturesForAddress(owner, { limit: 1 }))[0];
    const beforeKey = before ? sigKey(before) : null;

    setPhase("signing");
    await signAndSend(tx.serialize());
    setPhase("waiting");

    for (let i = 0; i < 20; i++) {
      await sleep(1500);
      const sigs = await client.getSignaturesForAddress(owner, { limit: 3 });
      for (const s of sigs) {
        if (sigKey(s) === beforeKey) break;
        const info = await readVoid(client, s);
        if (info?.failed) throw new Error("Transaction failed on-chain.");
        if (info) return info;
      }
    }
    throw new Error("Action sent, but the result is not available yet. Refresh in a moment.");
  }

  const busy = phase !== "idle";
  const betNum = parseFloat(bet) || 0;

  async function guard(fn) {
    setErrorMsg("");
    try { await fn(); } catch (e) { setErrorMsg(String(e?.message || e).slice(0, 200)); }
    setPhase("idle");
    loadState();
  }

  const handleStart = () => guard(async () => {
    if (betNum < MIN_BET || betNum > MAX_BET) throw new Error(`Bet must be between ${MIN_BET} and ${MAX_BET} RIALO.`);
    if (betNum > balance - FEE_BUFFER) throw new Error("Insufficient balance.");
    const d = new Uint8Array(9);
    d[0] = 0;
    new DataView(d.buffer).setBigUint64(1, BigInt(Math.round(betNum * 1e9)), true);
    const res = await doAction(d);
    if (res.kind === "start") { setTrail({}); setEnded(null); }
  });

  const handlePick = (tile) => guard(async () => {
    const d = new Uint8Array(10);
    d[0] = 1; d[1] = tile;
    new DataView(d.buffer).setBigUint64(2, BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)), true);
    const res = await doAction(d);
    if (res.kind === "safe") {
      setTrail((t) => ({ ...t, [res.row]: { picked: res.tile, voidIdx: res.voidIdx } }));
    } else if (res.kind === "hit") {
      setTrail((t) => ({ ...t, [res.row]: { picked: res.tile, voidIdx: res.voidIdx } }));
      setEnded({ type: "hit", row: res.row, tile: res.tile });
    } else if (res.kind === "win") {
      setTrail((t) => ({ ...t, [res.row]: { picked: res.tile, voidIdx: res.voidIdx } }));
      setEnded({ type: "win", payout: res.payout, row: res.row });
    }
  });

  const handleCashout = () => guard(async () => {
    const res = await doAction(new Uint8Array([2]));
    if (res.kind === "cashout") setEnded({ type: "cash", payout: res.payout, step: res.step });
  });

  const newRun = () => { setEnded(null); setTrail({}); setErrorMsg(""); };

  // baris yang sudah dilewati
  const cleared = run.active ? run.step
    : ended ? (ended.type === "win" ? ended.row + 1 : ended.type === "cash" ? ended.step : ended.row) : 0;
  const boardSeed = run.active || ended ? seed : null;
  const focusRow = run.active ? run.step : cleared;
  const rowsShown = boardSeed != null ? 200 : 6;
  const rowsData = buildRows(boardSeed, rowsShown);
  const cashValue = run.active && run.step > 0 ? run.bet * run.mult : 0;

  // ikuti baris aktif saat papan memanjang
  useEffect(() => {
    const el = document.getElementById(`vr-row-${focusRow}`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusRow, run.active, ended]);

  const panel = { width: "100%", maxWidth: 420, background: "#111218", border: "2px solid #d7ff1f", padding: 20, boxSizing: "border-box" };
  const muted = { color: "#8a8b9c" };
  const quick = { flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "2px solid #2a2b3a", background: "#0a0a0a", color: "#d7ff1f", cursor: "pointer" };
  const bigBtn = (disabled) => ({ width: "100%", padding: 14, borderRadius: 12, background: disabled ? "#333" : "#d7ff1f", color: disabled ? "#888" : "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16, cursor: disabled ? "not-allowed" : "pointer" });
  const phaseText = phase === "signing" ? "Confirm in wallet..." : phase === "waiting" ? "Waiting for result..." : "";

  function tileView(i, t, status) {
    const base = { flex: "1 1 0", minWidth: 0, maxWidth: 44, aspectRatio: "1 / 1", padding: 0, borderRadius: 8, background: "#0a0a0a", border: "2px solid #2a2b3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, boxSizing: "border-box", color: "#fff" };
    const tr = trail[i];
    if (status === "hit" && ended && t === ended.tile) return <div key={t} style={{ ...base, background: "#3a1218", border: "2px solid #ff4d4d", color: "#ff4d4d" }}>✕</div>;
    if (status === "cleared") {
      if (tr && t === tr.picked) return <div key={t} style={{ ...base, background: "#d7ff1f", border: "2px solid #d7ff1f", color: "#0a0a0a" }}>✓</div>;
      if (tr && t === tr.voidIdx) return <div key={t} style={{ ...base, color: "#5a2a32" }}>✕</div>;
      return <div key={t} style={{ ...base, opacity: 0.5 }} />;
    }
    if (status === "current") {
      const can = run.active === 1 && !busy;
      return (
        <button key={t} disabled={!can} onClick={() => handlePick(t)}
          style={{ ...base, border: "2px solid #d7ff1f", cursor: can ? "pointer" : "not-allowed", boxShadow: can ? "0 0 10px rgba(215,255,31,0.35)" : "none", opacity: can ? 1 : 0.6 }}>
        </button>
      );
    }
    return <div key={t} style={{ ...base, opacity: 0.35 }} />;
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 16, background: "#0a0a0a", color: "#fff", boxSizing: "border-box", gap: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <a href="/games" style={{ textDecoration: "none", fontWeight: 700 }}><span style={{ color: "#fff" }}>← Rialo</span><span style={{ color: "#d7ff1f" }}>Verse</span></a>
        <h2 style={{ margin: 0, fontSize: 20 }}>Void Run</h2>
      </div>

      {/* INFO */}
      <div style={{ ...panel, border: "2px solid #2a2b3a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, letterSpacing: 1, ...muted }}>RIALO TESTNET</span>
          {isConnected && <WalletMenu />}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, ...muted }}>
          <span>Balance: <b style={{ color: "#fff" }}>{fmt(balance, 4)} RIALO</b></span>
          <span>Pool: <b style={{ color: "#fff" }}>{fmt(pool, 2)} RIALO</b></span>
        </div>
      </div>

      {/* BOARD: baris terbawah = baris 1, papan memanjang ke atas dan bisa di-scroll */}
      <div style={panel}>
        <div style={{ display: "flex", flexDirection: "column-reverse", gap: 8, maxHeight: "58vh", overflowY: "auto" }}>
          {rowsData.map((r, i) => {
            const status = ended?.type === "hit" && i === ended.row ? "hit"
              : i < cleared ? "cleared"
              : run.active && i === run.step ? "current" : "locked";
            return (
              <div key={i} id={`vr-row-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px", flexShrink: 0, background: status === "hit" ? "#1d0f13" : "#15161f", border: `2px solid ${status === "current" ? "#d7ff1f" : status === "hit" ? "#ff4d4d" : "#2a2b3a"}` }}>
                <span style={{ width: 54, flexShrink: 0, fontSize: 13, fontWeight: 700, color: status === "current" ? "#d7ff1f" : status === "hit" ? "#ff4d4d" : "#8a8b9c" }}>{fmtMult(r.mult)}x</span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", gap: 6 }}>
                  {[...Array(r.n).keys()].map((t) => tileView(i, t, status))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTROLS */}
      <div style={panel}>
        {ended && (
          <>
            <p style={{ margin: "0 0 12px", textAlign: "center", fontWeight: 700, fontSize: 15, color: ended.type === "hit" ? "#ff4d4d" : "#d7ff1f" }}>
              {ended.type === "hit" ? `☠ Eliminated — you hit the void at row ${ended.row + 1}.`
                : ended.type === "win" ? `Max payout reached! You won ${fmt(ended.payout, 4)} RIALO!`
                : `Cashed out ${fmt(ended.payout, 4)} RIALO`}
            </p>
            <button onClick={newRun} style={bigBtn(false)}>NEW VOID RUN</button>
          </>
        )}

        {!ended && !isConnected && (
          <button onClick={connect} style={bigBtn(false)}>Connect Wallet</button>
        )}

        {!ended && isConnected && !run.active && (
          <>
            <div style={{ background: "#15161f", padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 12, ...muted }}>Bet Amount</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <input type="text" inputMode="decimal" placeholder="0.0" value={bet} disabled={busy}
                  onChange={(e) => setBet(sanitizeDecimalInput(e.target.value))}
                  style={{ flex: "1 1 0%", minWidth: 0, width: 0, border: "none", background: "transparent", fontSize: 22, outline: "none", color: "#fff" }} />
                <span style={{ background: "#0a0a0a", border: "2px solid #2a2b3a", padding: "6px 10px", fontWeight: 700, fontSize: 13 }}>RIALO</span>
              </div>
              <div style={{ fontSize: 11, marginTop: 8, ...muted }}>Min {MIN_BET} • Max {MAX_BET} RIALO</div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[1, 5, 10, 25].map((m) => (
                <button key={m} style={quick} disabled={busy} onClick={() => setBet(String(m))}>{m}</button>
              ))}
              <button style={quick} disabled={busy} onClick={() => setBet(String(Math.max(0, Math.floor(Math.min(MAX_BET, balance - FEE_BUFFER) * 100) / 100)))}>MAX</button>
            </div>
            <button onClick={handleStart} disabled={busy} className={busy ? "rialo-pulsing" : ""} style={bigBtn(busy)}>
              {busy ? phaseText : "START RUN"}
            </button>
          </>
        )}

        {!ended && isConnected && run.active === 1 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 12, ...muted }}>
              <span>Bet: <b style={{ color: "#fff" }}>{fmt(run.bet, 2)} RIALO</b></span>
              <span>Row {run.step + 1} • Next: <b style={{ color: "#d7ff1f" }}>{fmtMult(rowsData[run.step]?.mult || 0)}x</b></span>
            </div>
            <button onClick={handleCashout} disabled={busy || run.step === 0} className={busy ? "rialo-pulsing" : ""} style={bigBtn(busy || run.step === 0)}>
              {busy ? phaseText : run.step === 0 ? "Pick a tile to start climbing" : `CASH OUT ${fmt(cashValue, 4)} RIALO`}
            </button>
          </>
        )}

        {errorMsg && <p style={{ color: "#ff4d4d", marginTop: 12, textAlign: "center", fontSize: 13, wordBreak: "break-word" }}>{errorMsg}</p>}
      </div>

      {isConnected && history.length > 0 && (
        <div style={{ ...panel, border: "2px solid #2a2b3a" }}>
          <div style={{ fontSize: 11, letterSpacing: 1, marginBottom: 10, ...muted }}>HISTORY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((h, idx) => (
              <div key={idx} onClick={() => h.sig && window.open(EXPLORER_TX + h.sig, "_blank", "noopener")} style={{ cursor: h.sig ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", background: "#15161f", border: `2px solid ${h.win ? "#2f3a12" : "#3a1218"}`, fontSize: 13 }}>
                <span style={{ width: 48, fontWeight: 700, color: h.win ? "#d7ff1f" : "#ff4d4d" }}>{h.win ? "WIN" : "LOSE"}</span>
                <span style={{ flex: 1, ...muted }}>{h.bet != null ? `${fmt(h.bet, 2)} bet • ` : ""}{h.win ? `${h.rows} rows` : `row ${h.rows}`}</span>
                <b style={{ color: h.win ? "#d7ff1f" : "#ff4d4d" }}>{h.win ? (h.bet != null ? `+${fmt(h.payout - h.bet, 4)}` : fmt(h.payout, 4)) : `-${fmt(h.bet, 2)}`}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 420, fontSize: 12, textAlign: "center", marginBottom: 24, ...muted }}>
        Endless board: each row hides one void, and more tiles means a bigger multiplier. Climb as high as you dare and cash out any time. A run pays at most {fmt(MAX_PAYOUT, 0)} RIALO. Every pick is one transaction on Rialo Testnet.
      </div>

      <style>{`
        @keyframes rialoPulse { 0% { opacity: 1; } 50% { opacity: 0.55; } 100% { opacity: 1; } }
        .rialo-pulsing { animation: rialoPulse 1.1s ease-in-out infinite; }
      `}</style>
    </main>
  );
}
