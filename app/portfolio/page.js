"use client";
import { useState, useEffect, useCallback } from "react";
import { useRialoWallet } from "../providers";
import WalletMenu from "../WalletMenu";

// ====== Konfigurasi Rialo Testnet ======
const AMM_PROGRAM = "D6py9TbbsCTPABZfgpexc8fHXTsDG2x9eJivfzyR7pDi";
const MINT = "7PrFhdj8oktWHXN7jvQHV2GBXjhFFYjH4rUEom1gZ5dz";
const POOL_PDA = "5DdJ1354CHMdzj533QgW8ytLvV9pQ4JRuCoL9sg9zkSj";
const VAULT_TOKEN = "ETx31zoDMa9DB247SZ7pQLms7AMRtRdmh38L2vwQFTFA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const EXPLORER_TX_BASE = "https://rialo-explorer-testnet-direct.vercel.app/txs/";

const TOKENS = {
  RIALO: { iconLetter: "R", iconBg: "#d7ff1f", iconColor: "#0a0a0a" },
  RVerse: { iconLetter: "V", iconBg: "#7c5cff", iconColor: "#fff" },
};
const DONUT_COLORS = { RIALO: "#d7ff1f", RVerse: "#7c5cff" };

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

function formatNice(numStr, maxDecimals = 6) {
  const n = Number(numStr);
  if (!isFinite(n)) return "0";
  if (n === 0) return "0";
  if (n < 0.000001) return "<0.000001";
  return n.toFixed(maxDecimals).replace(/\.?0+$/, "") || "0";
}

function TokenIcon({ token, size = 22 }) {
  const cfg = TOKENS[token];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: cfg.iconBg, color: cfg.iconColor, fontSize: size * 0.5, fontWeight: 800, flexShrink: 0 }}>
      {cfg.iconLetter}
    </span>
  );
}

function DonutChart({ holdings }) {
  const values = holdings.map((h) => Number(h.value) || 0);
  const total = values.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  const stops = holdings
    .map((h, i) => {
      const pct = total > 0 ? (values[i] / total) * 100 : 0;
      const start = cumulative;
      cumulative += pct;
      return `${DONUT_COLORS[h.token]} ${start}% ${cumulative}%`;
    })
    .join(", ");
  const gradient = total > 0 ? `conic-gradient(${stops})` : "#2a2b3a";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
      <div style={{ width: 110, height: 110, borderRadius: "50%", background: gradient, position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: 13, borderRadius: "50%", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <span style={{ color: "#8a8b9c", fontSize: 9, letterSpacing: 1 }}>ASSETS</span>
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>{holdings.length}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {holdings.map((h, i) => {
          const pct = total > 0 ? ((values[i] / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={h.symbol} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: DONUT_COLORS[h.token], display: "inline-block", flexShrink: 0 }}></span>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{h.symbol}</span>
              <span style={{ color: "#8a8b9c", fontSize: 12 }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(unixSeconds) {
  if (!unixSeconds) return "";
  let t = Number(unixSeconds);
  if (t > 1e17) t = t / 1e9; else if (t > 1e14) t = t / 1e6; else if (t > 1e11) t = t / 1e3;
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - t));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const toUnits = (str, dec) => {
  const [w, f = ""] = String(str).split(".");
  return BigInt(w || "0") * 10n ** BigInt(dec) + BigInt((f + "0".repeat(dec)).slice(0, dec) || "0");
};

export default function PortfolioPage() {
  const { address, isConnected, connect, disconnect } = useRialoWallet();

  const [rialo, setRialo] = useState(0n);   // kelvin
  const [rverse, setRverse] = useState(0n); // satuan 1e6
  const [price, setPrice] = useState(0);    // 1 RVerse dalam RIALO (dari pool)
  const [txs, setTxs] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState("");

  const loadHoldings = useCallback(async () => {
    if (!address) { setRialo(0n); setRverse(0n); return; }
    try {
      const { cdk, client } = await loadCdk();
      const P = (s) => cdk.PublicKey.fromString(s);
      const owner = P(address);
      try { setRialo(BigInt(await client.getBalance(owner))); } catch {}
      try {
        const [ata] = cdk.PublicKey.findProgramAddress([owner.toBytes(), P(TOKEN_2022).toBytes(), P(MINT).toBytes()], P(ATA_PROGRAM));
        setRverse(toUnits((await client.getTokenAccountBalance(ata)).uiAmountString, 6));
      } catch { setRverse(0n); }
      try {
        const poolRialo = Number(BigInt(await client.getBalance(P(POOL_PDA)))) / 1e9;
        const poolToken = Number(toUnits((await client.getTokenAccountBalance(P(VAULT_TOKEN))).uiAmountString, 6)) / 1e6;
        setPrice(poolToken > 0 ? poolRialo / poolToken : 0);
      } catch {}
    } catch {}
  }, [address]);

  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  useEffect(() => {
    if (!address) { setTxs([]); return; }
    let cancelled = false;
    setTxLoading(true);
    setTxError("");
    (async () => {
      try {
        const { cdk, client } = await loadCdk();
        const sigs = await client.getSignaturesForAddress(cdk.PublicKey.fromString(address), { limit: 10 });
        const out = [];
        for (const s of sigs) {
          const sigStr = typeof s.signature === "string" ? s.signature : toBase58(Uint8Array.from(s.signature));
          let kind = "Other", ok = !s.err, delta = null;
          try {
            const tx = await client.queryClient.call("getTransaction", [{ signature: s.signature }]);
            const logs = tx?.meta?.logMessages || [];
            ok = !tx?.meta?.err;
            const vl = logs.find((l) => l.includes("void:"));
            if (vl) {
              const vt = vl.slice(vl.indexOf("void:"));
              const vk = vt.split(" ")[0].slice(5);
              const vn = (k) => { const m = vt.match(new RegExp("\\b" + k + "=(\\d+)")); return m ? Number(m[1]) / 1e9 : null; };
              if (vk === "start") { kind = "Void Run · Bet"; delta = -(vn("bet") || 0); }
              else if (vk === "safe") kind = "Void Run · Safe pick";
              else if (vk === "hit") kind = "Void Run · Hit the void";
              else if (vk === "cashout") { kind = "Void Run · Cash out"; delta = vn("payout"); }
              else if (vk === "win") { kind = "Void Run · Max win"; delta = vn("payout"); }
              else kind = "Void Run";
            }
            if (vl) { /* Void Run sudah ditangani */ } else if (logs.some((l) => l.includes(AMM_PROGRAM))) kind = "Swap";
            else if (logs.some((l) => l.includes("TransferChecked"))) kind = "Transfer RVerse";
            else if (logs.length) kind = "Transfer RIALO";
          } catch {}
          out.push({ sig: sigStr, ok, kind, delta, blockTime: s.blockTime ? Number(s.blockTime) : null });
        }
        if (!cancelled) setTxs(out);
      } catch {
        if (!cancelled) setTxError("Failed to load transaction history.");
      } finally {
        if (!cancelled) setTxLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  const rialoAmt = Number(rialo) / 1e9;
  const rverseAmt = Number(rverse) / 1e6;
  const holdings = [
    { symbol: "RIALO", token: "RIALO", amount: formatNice(rialoAmt, 4), value: rialoAmt },
    { symbol: "RVerse", token: "RVerse", amount: formatNice(rverseAmt, 2), value: rverseAmt * price },
  ];

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 16, background: "#0a0a0a", boxSizing: "border-box", gap: 16 }}>
      <div style={{ width: "100%", maxWidth: 480, marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <a href="/" style={{ textDecoration: "none", fontWeight: 700 }}>
            <span style={{ color: "#fff" }}>← Rialo</span><span style={{ color: "#d7ff1f" }}>Verse</span>
          </a>
          <h2 style={{ margin: 0, fontSize: 20, color: "#fff" }}>Portfolio</h2>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "#8a8b9c", letterSpacing: 1 }}>RIALO TESTNET</span>
        </div>

        {!isConnected ? (
          <div style={{ background: "#111218", border: "2px solid #d7ff1f", padding: 30, textAlign: "center" }}>
            <p style={{ color: "#8a8b9c", marginBottom: 16 }}>Connect your wallet to see your portfolio.</p>
            <button onClick={connect} style={{ padding: "12px 24px", borderRadius: 12, background: "#d7ff1f", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <WalletMenu />
            </div>

            {/* HOLDINGS */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, letterSpacing: 1, color: "#8a8b9c", marginBottom: 10, textTransform: "uppercase" }}>Holdings</h3>
              <DonutChart holdings={holdings} />
              <div style={{ background: "#111218", border: "2px solid #2a2b3a" }}>
                {holdings.map((h, i) => (
                  <div key={h.symbol} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: i < holdings.length - 1 ? "1px solid #2a2b3a" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <TokenIcon token={h.token} size={26} />
                      <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{h.symbol}</span>
                    </div>
                    <span style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>{h.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* TRANSACTION HISTORY */}
            <div>
              <h3 style={{ fontSize: 13, letterSpacing: 1, color: "#8a8b9c", marginBottom: 10, textTransform: "uppercase" }}>Transaction History</h3>

              {txLoading && <p style={{ color: "#8a8b9c", fontSize: 13, textAlign: "center", padding: 20 }}>Loading transactions...</p>}
              {txError && <p style={{ color: "#ff4d4d", fontSize: 13, textAlign: "center", padding: 20 }}>{txError}</p>}
              {!txLoading && !txError && txs.length === 0 && (
                <p style={{ color: "#8a8b9c", fontSize: 13, textAlign: "center", padding: 20 }}>No transactions yet on Rialo Testnet.</p>
              )}

              {!txLoading && txs.length > 0 && (
                <div style={{ background: "#111218", border: "2px solid #2a2b3a" }}>
                  {txs.map((tx, i) => (
                    <a key={tx.sig} href={`${EXPLORER_TX_BASE}${tx.sig}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: i < txs.length - 1 ? "1px solid #2a2b3a" : "none", textDecoration: "none", color: "inherit" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: tx.kind === "Swap" ? "#d7ff1f" : "#fff" }}>{tx.kind}</div>
                        <div style={{ fontSize: 11, color: "#8a8b9c", marginTop: 2 }}>{tx.sig.slice(0, 8)}...{tx.sig.slice(-6)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {tx.delta != null && tx.delta !== 0 && (<div style={{ fontSize: 13, fontWeight: 700, color: tx.delta > 0 ? "#d7ff1f" : "#ff4d4d" }}>{tx.delta > 0 ? "+" : ""}{Number(tx.delta.toFixed(4))} RIALO</div>)}
                        <div style={{ fontSize: 13, fontWeight: 600, color: tx.ok ? "#8affa0" : "#ff8a8a" }}>{tx.ok ? "Success" : "Failed"}</div>
                        <div style={{ fontSize: 11, color: "#8a8b9c", marginTop: 2 }}>{timeAgo(tx.blockTime)}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

