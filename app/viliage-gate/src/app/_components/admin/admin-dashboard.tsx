"use client";

import { api } from "@/trpc/react";
import { useState } from "react";

const formatVp = (raw?: string) => {
  if (!raw) return "0";
  const value = BigInt(raw);
  const base = 10n ** 18n;
  const whole = value / base;
  const fraction = value % base;
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, 3);
  return `${whole}.${fractionStr}`;
};

export function AdminDashboard() {
  const { data, isLoading } = api.admin.getStats.useQuery();
  const [limit, setLimit] = useState(200);
  const [dryRun, setDryRun] = useState(true);

  const trigger = api.admin.triggerSettlement.useMutation();

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-black/10 bg-white/70 p-8">
        <p className="text-[var(--color-ink-soft)]">Loading admin stats...</p>
      </section>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
          Pending settlement
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          {formatVp(data?.pendingVP)} VP
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          {data?.pendingUsers ?? 0} users pending
        </p>
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-black/10 bg-white/80 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
              Latest settlement
            </p>
            <p className="mt-2 text-[var(--color-ink)]">
              {data?.latestSettlement?.nonce ?? "-"}
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/80 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
              Topic status
            </p>
            <div className="mt-2 text-[var(--color-ink-soft)]">
              {data?.topicStats &&
                Object.entries(data.topicStats).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span>{status}</span>
                    <span>{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
          Trigger settlement
        </p>
        <h2 className="mt-3 text-2xl font-semibold">Manual batch</h2>
        <div className="mt-4 grid gap-4">
          <label className="text-sm text-[var(--color-ink-soft)]">
            Batch size
            <input
              type="number"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
              min={1}
              max={200}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => setDryRun(event.target.checked)}
            />
            Dry run (no signature)
          </label>
          <button
            type="button"
            className="rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)]"
            onClick={() => trigger.mutate({ limit, dryRun })}
            disabled={trigger.isPending}
          >
            {trigger.isPending ? "Working..." : "Trigger settlement"}
          </button>
        </div>
        {trigger.data && (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white/80 p-4 text-xs text-[var(--color-ink-soft)]">
            <p>Triggered: {String(trigger.data.triggered)}</p>
            {trigger.data.reason && <p>Reason: {trigger.data.reason}</p>}
            {trigger.data.nonce && <p>Nonce: {trigger.data.nonce}</p>}
            {trigger.data.signature && (
              <p className="break-all">Signature: {trigger.data.signature}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
