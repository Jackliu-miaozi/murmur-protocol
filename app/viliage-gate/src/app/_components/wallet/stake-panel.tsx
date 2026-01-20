"use client";

import { useState } from "react";
import { useWalletAuth } from "@/app/_components/wallet-auth";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

const VP_ABI = [
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "stakeVdot",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const parseToWei = (value: string) => {
  if (!value) return 0n;
  const [whole, fraction = ""] = value.split(".");
  const fractionPadded = (fraction + "000000000000000000").slice(0, 18);
  return BigInt(whole ?? "0") * 10n ** 18n + BigInt(fractionPadded);
};

export function StakePanel({ vpAddress }: { vpAddress?: string }) {
  const { isConnected } = useWalletAuth();
  const [amount, setAmount] = useState("");
  
  // Use passed prop or fallback to env vars exposed to client
  const contractAddress = vpAddress || 
    process.env.NEXT_PUBLIC_VP_TOKEN_ADDRESS || 
    process.env.VP_TOKEN_ADDRESS;

  const { data: hash, isPending, writeContract } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleStake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !contractAddress) return;
    
    writeContract({
      address: contractAddress as `0x${string}`,
      abi: VP_ABI,
      functionName: "stakeVdot",
      args: [parseToWei(amount)],
    });
  };

  return (
    <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
        Get VP
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Stake vDOT</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        Stake your vDOT tokens to receive VP energy.
      </p>
      
      <form onSubmit={handleStake} className="mt-6 grid gap-4">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount of vDOT"
          className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          disabled={!isConnected || isPending}
        />
        <button
          type="submit"
          disabled={!isConnected || isPending || !amount || !contractAddress}
          className="rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)] disabled:opacity-50"
        >
          {isPending ? "Staking..." : "Stake"}
        </button>
      </form>

      {hash && (
        <div className="mt-6 rounded-2xl border border-black/10 bg-white/80 p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
            Transaction
          </p>
          <p className="mt-2 break-all text-xs text-[var(--color-ink-soft)]">
            Hash: {hash}
          </p>
          <p className="mt-2 text-xs font-semibold text-[var(--color-ink)]">
            {isConfirming ? "Confirming..." : isSuccess ? "Success!" : ""}
          </p>
        </div>
      )}
      {!isConnected && (
        <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
          Connect your wallet to stake.
        </p>
      )}
    </section>
  );
}
