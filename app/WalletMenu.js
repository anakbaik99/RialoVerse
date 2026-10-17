"use client";
import { useState, useEffect, useRef } from "react";
import { useRialoWallet } from "./providers";

export default function WalletMenu() {
  const { address, disconnect } = useRialoWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  if (!address) return null;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999, border: "2px solid #d7ff1f", background: "#0a0a0a", color: "#d7ff1f", fontWeight: 600, cursor: "pointer" }}>
        {address.slice(0, 6)}...{address.slice(-4)} <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", minWidth: 150, background: "#111218", border: "2px solid #2a2b3a", zIndex: 50 }}>
          <button onClick={() => { setOpen(false); disconnect(); }} style={{ width: "100%", padding: "10px 14px", textAlign: "left", background: "transparent", border: "none", color: "#ff4d4d", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
