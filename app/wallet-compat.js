"use client";
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
