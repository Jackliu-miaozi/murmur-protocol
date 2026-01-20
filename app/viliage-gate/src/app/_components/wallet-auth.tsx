"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { injected } from "wagmi/connectors";

export type WalletAuthHeaders = {
  "x-wallet-address": string;
  "x-wallet-message": string;
  "x-wallet-signature": string;
};

const TTL_MS = 5 * 60 * 1000;

export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [cached, setCached] = useState<{
    message: string;
    signature: string;
    expiresAt: number;
  } | null>(null);

  const connectWallet = useCallback(async () => {
    await connectAsync({ connector: injected() });
  }, [connectAsync]);

  const signHeaders = useCallback(async (): Promise<WalletAuthHeaders | null> => {
    if (!address || !isConnected) {
      return null;
    }

    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return {
        "x-wallet-address": address,
        "x-wallet-message": cached.message,
        "x-wallet-signature": cached.signature,
      };
    }

    const message = `Murmur login ${address} ${new Date().toISOString()}`;
    const signature = await signMessageAsync({ message });

    setCached({
      message,
      signature,
      expiresAt: now + TTL_MS,
    });

    return {
      "x-wallet-address": address,
      "x-wallet-message": message,
      "x-wallet-signature": signature,
    };
  }, [address, cached, isConnected, signMessageAsync]);

  return {
    address,
    isConnected,
    connectWallet,
    disconnect,
    isConnecting,
    signHeaders,
  };
}

export function WalletConnectButton() {
  const {
    address,
    isConnected,
    connectWallet,
    disconnect,
    isConnecting,
  } = useWalletAuth();

  if (isConnected) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:text-white"
      >
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => connectWallet()}
      className="rounded-full border border-white/30 px-4 py-2 text-sm text-white hover:border-white"
      disabled={isConnecting}
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
