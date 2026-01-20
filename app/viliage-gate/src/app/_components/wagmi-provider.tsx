"use client";

import { type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { passetHub } from "./wagmi-chain";

const config = createConfig({
  chains: [passetHub],
  transports: {
    [passetHub.id]: http(),
  },
});

export function WagmiProviders({ children }: { children: ReactNode }) {
  return <WagmiProvider config={config}>{children}</WagmiProvider>;
}
