"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getWallets } from "@wallet-standard/core";
import { RIALO_CHAIN } from "./wagmi";

const WalletContext = createContext(null);

// Pengganti useAccount/useConnect dari wagmi
export function useRialoWallet() {
  return useContext(WalletContext);
}

export function Providers({ children }) {
  const [wallet, setWallet] = useState(null);   // ekstensi Rialo Wallet (kalau terdeteksi)
  const [account, setAccount] = useState(null); // akun yang sedang connect
  const [error, setError] = useState(null);

  // Deteksi ekstensi; wallet bisa terdaftar setelah halaman load
  useEffect(() => {
    const api = getWallets();
    const find = () => api.get().find((w) => /rialo/i.test(w.name)) || null;
    setWallet(find());
    const off = api.on("register", () => setWallet(find()));
    return () => off();
  }, []);

  // Ikuti perubahan akun dari ekstensi
  useEffect(() => {
    const events = wallet?.features?.["standard:events"];
    if (!events) return;
    return events.on("change", ({ accounts }) => {
      if (accounts) setAccount(accounts[0] ?? null);
    });
  }, [wallet]);

  const connect = useCallback(async () => {
    setError(null);
    if (!wallet) {
      setError("Rialo Wallet belum terpasang di browser ini");
      return;
    }
    try {
      const { accounts } = await wallet.features["standard:connect"].connect();
      setAccount(accounts[0] ?? null);
    } catch (e) {
      setError(e?.message || "Gagal connect");
    }
  }, [wallet]);

  const disconnect = useCallback(async () => {
    try {
      await wallet?.features?.["standard:disconnect"]?.disconnect();
    } finally {
      setAccount(null);
    }
  }, [wallet]);

  // Kirim transaksi (txBytes = Uint8Array hasil build transaksi)
  const signAndSend = useCallback(
    async (txBytes) => {
      const feature = wallet?.features?.["rialo:signAndSendTransaction"];
      if (!feature || !account) throw new Error("Wallet belum connect");
      return feature.signAndSendTransaction({
        account,
        transaction: txBytes,
        chain: RIALO_CHAIN,
      });
    },
    [wallet, account]
  );

  const value = {
    installed: !!wallet,
    isConnected: !!account,
    address: account?.address ?? null,
    account,
    error,
    connect,
    disconnect,
    signAndSend,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
