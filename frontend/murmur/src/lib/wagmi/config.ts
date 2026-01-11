import { http, createConfig } from "wagmi";
import { defineChain } from "viem";

// Define local PolkaVM chain
// IMPORTANT: Chain ID must match the actual chain ID (420420420) for EIP-712 signature verification
// This must match:
// 1. The chain ID used when deploying contracts (block.chainid in AIScoreVerifier constructor)
// 2. The chain ID used in AI signature generation (/api/ai-score/route.ts)
// 3. The chain ID configured in MetaMask
export const localPolkaVM = defineChain({
  id: 420420420,
  name: "Local PolkaVM",
  nativeCurrency: {
    decimals: 18,
    name: "DOT",
    symbol: "DOT",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
  testnet: true,
});

// Create wagmi config
export const config = createConfig({
  chains: [localPolkaVM],
  transports: {
    [localPolkaVM.id]: http(),
  },
});

// Export chain for use in components
export { localPolkaVM as chain };
