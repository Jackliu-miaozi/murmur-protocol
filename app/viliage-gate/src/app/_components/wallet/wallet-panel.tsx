"use client";

import { useMemo } from "react";
import { api } from "@/trpc/react";
import { useWalletAuth } from "@/app/_components/wallet-auth";
import { formatVp } from "@/app/_components/utils/vp";

export function WalletPanel() {
  const { address, isConnected } = useWalletAuth();
  const { data, isLoading } = api.vp.getBalance.useQuery(
    { address: address ?? "0x0000000000000000000000000000000000000000" },
    { enabled: Boolean(address) },
  );

  const sync = api.vp.syncBalance.useMutation();

  const balance = useMemo(() => formatVp(data?.balance), [data?.balance]);

  return (
    <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
            VP energy
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            {isConnected ? balance : "Connect wallet"}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            Natural respiration restores VP gradually over time.
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-black/10 px-5 py-2 text-sm font-semibold text-[var(--color-ink)]"
          onClick={() => sync.mutate()}
          disabled={!isConnected || sync.isPending}
        >
          {sync.isPending ? "Syncing..." : "Sync balance"}
        </button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
            Status
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink)]">
            {isConnected ? "Connected" : "Not connected"}
          </p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
            Address
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink)]">
            {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
            Balance (VP)
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink)]">
            {isLoading ? "Loading..." : balance}
          </p>
        </div>
      </div>
    </section>
  );
}
