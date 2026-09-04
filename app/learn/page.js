"use client";
import { useState } from "react";

const TOPICS = [
  {
    id: "wallet",
    label: "Wallet Connect",
    title: "Connecting Your Wallet",
    intro: "How RialoVerse links to your wallet safely, without ever touching your funds.",
    points: [
      "Supports MetaMask, WalletConnect, Rainbow, and other wallets via RainbowKit.",
      "Connecting only reads your public wallet address - it never asks for your seed phrase or private key.",
      "No funds move when you connect. Transactions only happen when you explicitly approve a swap or claim.",
      "On mobile, tapping a wallet option deep-links into that wallet's app; on desktop, it opens the browser extension.",
    ],
  },
  {
    id: "swap",
    label: "Swap",
    title: "Swapping ETH & RIALO",
    intro: "An automated market maker (AMM) pool lets you trade ETH and RIALO instantly on Sepolia testnet.",
    points: [
      "Uses a constant-product formula (like Uniswap) with a 0.3% pool fee on every trade.",
      "Price impact shows how much your trade will move the pool price - larger trades relative to pool size move the price more.",
      "Slippage tolerance (0.5% / 1% / 3%) protects you: the swap fails instead of executing at a worse price than expected.",
      "Swapping RIALO to ETH requires an approval transaction first, so the swap contract can move your tokens.",
      "Every swap is recorded on-chain and shown in your Recent Swaps history.",
    ],
  },
  {
    id: "faucet",
    label: "Faucet",
    title: "Claiming Free RIALO",
    intro: "Get test tokens to try out RialoVerse without spending real funds.",
    points: [
      "Claim 50 RIALO for free, once every 24 hours.",
      "The cooldown is tracked on-chain per wallet address, not per device or browser.",
      "Claiming only costs a small amount of Sepolia testnet ETH for gas - RIALO itself is free.",
      "If the faucet balance runs low, claims are paused until it's refilled.",
    ],
  },
  {
    id: "comi",
    label: "COMI",
    title: "COMI, Your AI Assistant",
    intro: "An AI chat assistant powered by Google Gemini that understands RialoVerse and can help you take action.",
    points: [
      "Ask COMI anything about RialoVerse, Swap, the Faucet, or the wider Rialo Network ecosystem.",
      "Tell it what you want in plain language, like 'swap 0.01 eth to rialo' or 'claim faucet'.",
      "COMI never signs transactions for you - it hands you off to the Swap or Faucet page with the details pre-filled, and you approve everything yourself in your wallet.",
      "If COMI doesn't know something, it will say so instead of guessing.",
    ],
  },
];

export default function LearnPage() {
  const [activeId, setActiveId] = useState(TOPICS[0].id);
  const active = TOPICS.find((t) => t.id === activeId);

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", padding: "24px 16px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <a href="/" style={{ textDecoration: "none", fontWeight: 700 }}><span style={{ color: "#fff" }}>← Rialo</span><span style={{ color: "#d7ff1f" }}>Verse</span></a>
          <h2 style={{ margin: 0, fontSize: 20 }}>Learn</h2>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d7ff1f", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
            RialoVerse Guide
          </div>
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Learn how everything works</h1>
          <p style={{ color: "#8a8b9c", fontSize: 14, margin: 0 }}>Pick a topic below to see how it works and what to expect.</p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 20 }}>
          {TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              style={{
                padding: "10px 16px",
                borderRadius: 0,
                border: activeId === t.id ? "2px solid #d7ff1f" : "2px solid #2a2b3a",
                background: activeId === t.id ? "#d7ff1f" : "#0a0a0a",
                color: activeId === t.id ? "#0a0a0a" : "#fff",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <div style={{ background: "#111218", borderRadius: 0, padding: 28, border: "2px solid #d7ff1f", boxShadow: "none" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{active.icon}</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>{active.title}</h2>
          <p style={{ color: "#8a8b9c", fontSize: 15, marginBottom: 20 }}>{active.intro}</p>
          <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {active.points.map((p, i) => (
              <li key={i} style={{ fontSize: 14, color: "#fff", lineHeight: 1.5 }}>{p}</li>
            ))}
          </ul>

          {active.id === "swap" && (
            <a href="/swap" style={{ display: "inline-block", marginTop: 24, padding: "10px 20px", borderRadius: 0, background: "#d7ff1f", color: "#0a0a0a", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
              Try Swap →
            </a>
          )}
          {active.id === "faucet" && (
            <a href="/faucet" style={{ display: "inline-block", marginTop: 24, padding: "10px 20px", borderRadius: 0, background: "#d7ff1f", color: "#0a0a0a", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
              Try Faucet →
            </a>
          )}
          {active.id === "comi" && (
            <a href="/comi" style={{ display: "inline-block", marginTop: 24, padding: "10px 20px", borderRadius: 0, background: "#d7ff1f", color: "#0a0a0a", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
              Chat with COMI →
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
