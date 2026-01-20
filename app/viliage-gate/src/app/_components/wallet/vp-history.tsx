"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/trpc/react";
import { formatVp } from "@/app/_components/utils/vp";

export function VpHistory() {
  const { data, isLoading } = api.settlement.getUserVpHistory.useQuery();
  const [filter, setFilter] = useState("ALL");

  const filtered = useMemo(() => {
    if (!data?.consumptions) return [];
    if (filter === "ALL") return data.consumptions;
    return data.consumptions.filter((entry) => entry.action === filter);
  }, [data?.consumptions, filter]);

  return (
    <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
            VP history
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Consumption & recovery</h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-[var(--color-ink-soft)]">
            Unsettled: {formatVp(data?.unsettled)} VP
          </p>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs"
          >
            <option value="ALL">All</option>
            <option value="MESSAGE">Message</option>
            <option value="LIKE">Like</option>
            <option value="CREATE_TOPIC">Create Topic</option>
          </select>
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        {isLoading && (
          <p className="text-[var(--color-ink-soft)]">Loading history...</p>
        )}
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3"
          >
            <div className="flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
              <span>{entry.action}</span>
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <Link
                href={`/topics/${entry.topicId}`}
                className="text-[var(--color-ink)] hover:underline"
              >
                {entry.topicTitle ?? `Topic #${entry.topicId}`}
              </Link>
              <span className="text-[var(--color-ink)]">
                -{formatVp(entry.amount)} VP
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && !isLoading && (
          <p className="text-[var(--color-ink-soft)]">No VP activity yet.</p>
        )}
      </div>
    </section>
  );
}
