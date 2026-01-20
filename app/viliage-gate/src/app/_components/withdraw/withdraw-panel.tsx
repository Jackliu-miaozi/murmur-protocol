"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { useWalletAuth } from "@/app/_components/wallet-auth";

const parseToWei = (value: string) => {
  if (!value) return 0n;
  const [whole, fraction = ""] = value.split(".");
  const fractionPadded = (fraction + "000000000000000000").slice(0, 18);
  return BigInt(whole ?? "0") * 10n ** 18n + BigInt(fractionPadded);
};

export function WithdrawPanel() {
  const { address, isConnected } = useWalletAuth();
  const [vpAmount, setVpAmount] = useState("");
  const [vdotReturn, setVdotReturn] = useState("");

  const { data: balanceData } = api.vp.getBalance.useQuery(
    { address: address ?? "0x0000000000000000000000000000000000000000" },
    { enabled: Boolean(address) },
  );
  const withdraw = api.withdraw.signWithdraw.useMutation();

  const available = balanceData?.balance
    ? `${(BigInt(balanceData.balance) / 10n ** 18n).toString()} VP`
    : "-";

  return (
    <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
        Withdraw VP
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Exit to vDOT</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        Sign a withdrawal request to burn VP and reclaim your staked vDOT.
      </p>
      <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
        Available balance: {available}
      </p>
      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const burn = parseToWei(vpAmount).toString();
          const vdot = parseToWei(vdotReturn).toString();
          withdraw.mutate({ vpBurnAmount: burn, vdotReturn: vdot });
        }}
      >
        <input
          value={vpAmount}
          onChange={(event) => setVpAmount(event.target.value)}
          placeholder="VP to burn"
          className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          disabled={!isConnected}
        />
        <input
          value={vdotReturn}
          onChange={(event) => setVdotReturn(event.target.value)}
          placeholder="vDOT to return"
          className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          disabled={!isConnected}
        />
        <button
          type="submit"
          className="rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)]"
          disabled={!isConnected || withdraw.isPending}
        >
          {withdraw.isPending ? "Signing..." : "Request signature"}
        </button>
      </form>
      {withdraw.data && (
        <div className="mt-6 rounded-2xl border border-black/10 bg-white/80 p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
            Signature ready
          </p>
          <p className="mt-2 break-all text-xs text-[var(--color-ink-soft)]">
            Nonce: {withdraw.data.nonce}
          </p>
          <p className="mt-2 break-all text-xs text-[var(--color-ink-soft)]">
            Signature: {withdraw.data.signature}
          </p>
        </div>
      )}
      {!isConnected && (
        <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
          Connect your wallet to request a signature.
        </p>
      )}
    </section>
  );
}
