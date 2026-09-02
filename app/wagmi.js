import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'RialoVerse',
  projectId: '87c8edb802c4065ca2cff4704d2a985c',
  chains: [sepolia],
  ssr: true,
});
