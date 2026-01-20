"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { formatVp } from "@/app/_components/utils/vp";

export function VpHistoryMini() {
  const { data, isLoading } = api.settlement.getUserVpHistory.useQuery();

  const recent = data?.consumptions.slice(0, 3) ?? [];

  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
          Recent VP
        </p>
        <span className="text-xs text-[var(--color-ink-soft)]">
          Unsettled {formatVp(data?.unsettled, 2)}
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {isLoading && (
          <p className="text-[var(--color-ink-soft)]">Loading...</p>
        )}
        {recent.map((entry) => (
          <div
            key={entry.id}
            className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 text-xs"
          >
            <div className="flex items-center justify-between text-[var(--color-ink-soft)]">
              <span>{entry.action}</span>
              <span>-{formatVp(entry.amount, 2)} VP</span>
            </div>
            <div className="mt-2">
              <Link
                href={`/topics/${entry.topicId}`}
                className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
              >
                {entry.topicTitle ?? `Topic #${entry.topicId}`}
              </Link>
            </div>
          </div>
        ))}
        {recent.length === 0 && !isLoading && (
          <p className="text-[var(--color-ink-soft)]">No VP activity yet.</p>
        )}
      </div>
    </div>
  );
}
