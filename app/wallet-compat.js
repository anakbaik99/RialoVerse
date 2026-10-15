"use client";
// Lapisan kompatibilitas sementara: nama hook lama (wagmi/RainbowKit) dipetakan
// ke wallet Rialo. Bagian on-chain (baca/tulis kontrak) masih kosong sampai
// program Rialo untuk swap/faucet siap.
import { useRialoWallet } from "./providers";

export function useAccount() {
  const { address, isConnected } = useRialoWallet();
  return { address, isConnected };
}

export function useConnectModal() {
  const { connect } = useRialoWallet();
  return { openConnectModal: connect };
}

export function useAccountModal() {
  const { disconnect } = useRialoWallet();
  return { openAccountModal: disconnect };
}

// Stub: belum ada data on-chain Rialo
const empty = () => ({
  data: undefined,
  refetch: async () => {},
  isLoading: false,
  isSuccess: false,
  isError: false,
  error: null,
});

export const useReadContract = empty;
export const useBalance = empty;
export const useWaitForTransactionReceipt = empty;

export function useWriteContract() {
  return {
    writeContract: () => alert("Fitur ini belum tersedia di Rialo Testnet"),
    data: undefined,
    isPending: false,
    error: null,
  };
}
