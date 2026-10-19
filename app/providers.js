"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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

  // Connect dengan percobaan ulang otomatis: kalau ekstensi masih terkunci, setelah password
  // dimasukkan permintaan koneksi muncul sendiri tanpa menekan Connect lagi.
  const connectingRef = useRef(false);
  const cancelRef = useRef(false);

  const connect = useCallback(async () => {
    if (!wallet) {
      window.open("https://chromewebstore.google.com/detail/rialo-wallet/dbmgekigjgnahdnfgfpdognodiegpmcg", "_blank");
      return;
    }
    // menekan Connect saat sedang mencoba = membatalkan
    if (connectingRef.current) {
      cancelRef.current = true;
      return;
    }
    connectingRef.current = true;
    cancelRef.current = false;
    setError(null);

    let connected = false;
    let lastError = null;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const delays = [1500, 2500, 4000, 6000, 8000];
    const deadline = Date.now() + 75000;

    try {
      for (let i = 0; !connected && !cancelRef.current && Date.now() < deadline; i++) {
        const attempt = wallet.features["standard:connect"].connect();
        // kalau permintaan ini baru selesai belakangan (setelah timeout), tetap dipakai
        attempt.then((res) => {
          if (!connected && res?.accounts?.length) {
            connected = true;
            setAccount(res.accounts[0]);
          }
        }).catch(() => {});
        try {
          const res = await Promise.race([
            attempt,
            new Promise((_, rej) => setTimeout(() => rej(new Error("__timeout")), 10000)),
          ]);
          if (res?.accounts?.length) {
            connected = true;
            setAccount(res.accounts[0]);
            break;
          }
          lastError = "No account returned";
          break;
        } catch (e) {
          const msg = String(e?.message || e);
          if (/reject|denied|declin|cancel|refus/i.test(msg)) {
            lastError = msg;
            break;
          }
          // terkunci atau belum menjawab: coba lagi sebentar lagi
          await wait(delays[Math.min(i, delays.length - 1)]);
        }
      }
      if (!connected && !cancelRef.current && !lastError) {
        lastError = "Wallet did not respond. Unlock it, then press Connect again.";
      }
      if (!connected && lastError) setError(lastError);
    } finally {
      connectingRef.current = false;
      cancelRef.current = false;
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
    openConnectModal: connect,
    openAccountModal: disconnect,
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
