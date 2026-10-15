"use client";
import { useRialoWallet } from "./providers";

// Pengganti <ConnectButton /> dari RainbowKit
export default function ConnectButton() {
  const { isConnected, address, connect, disconnect, installed } = useRialoWallet();

  if (isConnected) {
    const short = `${address.slice(0, 4)}...${address.slice(-4)}`;
    return <button onClick={disconnect}>{short}</button>;
  }
  return (
    <button onClick={connect}>
      {installed ? "Connect Wallet" : "Install Rialo Wallet"}
    </button>
  );
}
