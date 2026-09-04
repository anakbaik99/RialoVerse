"use client";
import { useState, useEffect } from "react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { formatEther, formatUnits } from "viem";

const TOKEN_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
];

const POOLS = {
  RIALO: {
    symbol: "RIALO",
    decimals: 18,
    tokenAddress: "0xEf601624E09126E369887D2845B68F4f9e968831",
    iconLetter: "R",
    iconBg: "#d7ff1f",
    iconColor: "#0a0a0a",
  },
  USDC: {
    symbol: "USDC",
    decimals: 6,
    tokenAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    iconLetter: "$",
    iconBg: "#2775CA",
    iconColor: "#fff",
  },
};

const EXPLORER_TX_BASE = "https://eth-sepolia.blockscout.com/tx/";
const EXPLORER_API_BASE = "https://eth-sepolia.blockscout.com/api";

function formatNice(numStr, maxDecimals = 6) {
  const n = Number(numStr);
  if (!isFinite(n)) return "0";
  if (n === 0) return "0";
  if (n < 0.000001) return "<0.000001";
  return n.toFixed(maxDecimals).replace(/\.?0+$/, "") || "0";
}

function TokenIcon({ token, size = 22 }) {
  if (token === "ETH") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: "#627eea", flexShrink: 0 }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
          <path d="M12 1L4 12.5L12 17L20 12.5L12 1Z" fill="#fff" fillOpacity="0.85" />
          <path d="M12 18.3L4 13.6L12 23L20 13.6L12 18.3Z" fill="#fff" />
          <path d="M12 1L4 12.5L12 16V1Z" fill="#fff" />
          <path d="M12 18.3V23L4 13.6L12 18.3Z" fill="#fff" fillOpacity="0.6" />
        </svg>
      </span>
    );
  }
  const cfg = POOLS[token];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: cfg.iconBg, color: cfg.iconColor, fontSize: size * 0.5, fontWeight: 800, flexShrink: 0 }}>
      {cfg.iconLetter}
    </span>
  );
}

function timeAgo(unixSeconds) {
  const seconds = Math.floor(Date.now() / 1000 - Number(unixSeconds));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  const [txs, setTxs] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState("");

  const { data: ethBalance } = useBalance({ address, query: { enabled: !!address } });
  const { data: rialoBalance } = useReadContract({
    address: POOLS.RIALO.tokenAddress,
    abi: TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: usdcBalance } = useReadContract({
    address: POOLS.USDC.tokenAddress,
    abi: TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const holdings = [
    { symbol: "ETH", token: "ETH", amount: ethBalance ? formatNice(formatEther(ethBalance.value), 5) : "0" },
    { symbol: "RIALO", token: "RIALO", amount: rialoBalance ? formatNice(formatUnits(rialoBalance, POOLS.RIALO.decimals), 2) : "0" },
    { symbol: "USDC", token: "USDC", amount: usdcBalance ? formatNice(formatUnits(usdcBalance, POOLS.USDC.decimals), 2) : "0" },
  ];

  useEffect(() => {
    if (!address) {
      setTxs([]);
      return;
    }
    let cancelled = false;
    setTxLoading(true);
    setTxError("");

    fetch(`${EXPLORER_API_BASE}?module=account&action=txlist&address=${address}&sort=desc`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.status === "1" && Array.isArray(data.result)) {
          setTxs(data.result.slice(0, 15));
        } else {
          setTxs([]);
        }
      })
      .catch(() => {
        if (!cancelled) setTxError("Gagal mengambil riwayat transaksi.");
      })
      .finally(() => {
        if (!cancelled) setTxLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 16, background: "#0a0a0a", boxSizing: "border-box", gap: 16 }}>
      <div style={{ width: "100%", maxWidth: 480, marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <a href="/" style={{ textDecoration: "none", color: "#d7ff1f", fontWeight: 700 }}>
            ← RialoVerse
          </a>
          <h2 style={{ margin: 0, fontSize: 20, color: "#fff" }}>Portfolio</h2>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "#8a8b9c", letterSpacing: 1 }}>SEPOLIA TESTNET</span>
        </div>

        {!isConnected ? (
          <div style={{ background: "#111218", border: "2px solid #d7ff1f", padding: 30, textAlign: "center" }}>
            <p style={{ color: "#8a8b9c", marginBottom: 16 }}>Connect your wallet to see your portfolio.</p>
            <button
              onClick={openConnectModal}
              style={{ padding: "12px 24px", borderRadius: 12, background: "#d7ff1f", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button
                onClick={openAccountModal}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999, border: "2px solid #d7ff1f", background: "#0a0a0a", color: "#d7ff1f", fontWeight: 600, cursor: "pointer" }}
              >
                {address.slice(0, 6)}...{address.slice(-4)}
              </button>
            </div>

            {/* HOLDINGS */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, letterSpacing: 1, color: "#8a8b9c", marginBottom: 10, textTransform: "uppercase" }}>
                Holdings
              </h3>
              <div style={{ background: "#111218", border: "2px solid #2a2b3a" }}>
                {holdings.map((h, i) => (
                  <div
                    key={h.symbol}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderBottom: i < holdings.length - 1 ? "1px solid #2a2b3a" : "none",
                    }}
                  >
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
              <h3 style={{ fontSize: 13, letterSpacing: 1, color: "#8a8b9c", marginBottom: 10, textTransform: "uppercase" }}>
                Transaction History
              </h3>

              {txLoading && <p style={{ color: "#8a8b9c", fontSize: 13, textAlign: "center", padding: 20 }}>Memuat transaksi...</p>}
              {txError && <p style={{ color: "#ff4d4d", fontSize: 13, textAlign: "center", padding: 20 }}>{txError}</p>}
              {!txLoading && !txError && txs.length === 0 && (
                <p style={{ color: "#8a8b9c", fontSize: 13, textAlign: "center", padding: 20 }}>Belum ada transaksi di Sepolia.</p>
              )}

              {!txLoading && txs.length > 0 && (
                <div style={{ background: "#111218", border: "2px solid #2a2b3a" }}>
                  {txs.map((tx, i) => {
                    const isOutgoing = tx.from?.toLowerCase() === address?.toLowerCase();
                    const valueEth = formatNice(formatEther(BigInt(tx.value || "0")), 5);
                    return (
                      <a
                        key={tx.hash}
                        href={`${EXPLORER_TX_BASE}${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 16px",
                          borderBottom: i < txs.length - 1 ? "1px solid #2a2b3a" : "none",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isOutgoing ? "#ff8a8a" : "#8affa0" }}>
                            {isOutgoing ? "Sent" : "Received"}
                          </div>
                          <div style={{ fontSize: 11, color: "#8a8b9c", marginTop: 2 }}>
                            {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                            {Number(valueEth) > 0 ? `${valueEth} ETH` : "Contract call"}
                          </div>
                          <div style={{ fontSize: 11, color: "#8a8b9c", marginTop: 2 }}>{timeAgo(tx.timeStamp)}</div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
