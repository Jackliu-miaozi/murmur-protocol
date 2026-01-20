"use client";

import { api } from "@/trpc/react";

export function CuratedPanel({ topicId }: { topicId: number }) {
  const { data, isLoading } = api.message.getCurated.useQuery({ topicId });

  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
          Curated
        </p>
        <span className="text-xs text-[var(--color-ink-soft)]">Top 50</span>
      </div>
      <div className="mt-4 grid gap-3">
        {isLoading && (
          <p className="text-[var(--color-ink-soft)]">Loading curated...</p>
        )}
        {data?.curated.map((entry) => (
          <div
            key={entry.id}
            className="rounded-2xl border border-black/10 bg-white/70 p-4"
          >
            <p className="text-xs text-[var(--color-ink-soft)]">
              #{entry.rank} | {entry.message.author.slice(0, 6)}
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink)]">
              {entry.message.content}
            </p>
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
              {entry.message.likeCount} likes
            </p>
          </div>
        ))}
        {data?.curated.length === 0 && !isLoading && (
          <p className="text-[var(--color-ink-soft)]">No curated messages yet.</p>
        )}
      </div>
    </div>
  );
}
