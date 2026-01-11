"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi/config";
import { useState, type ReactNode } from "react";

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProviderWrapper({ children }: WalletProviderProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
