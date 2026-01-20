"use client";

import Link from "next/link";
import { api } from "@/trpc/react";

export function TopicList() {
  const { data, isLoading } = api.topic.list.useQuery({ limit: 10 });

  if (isLoading) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-3xl border border-black/10 bg-white/50"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {data?.topics.map((topic) => (
        <Link
          key={topic.id}
          href={`/topics/${topic.id}`}
          className="group block rounded-3xl border border-black/10 bg-white/70 p-6 transition-colors hover:border-black/20 hover:bg-white"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                {topic.title}
              </h3>
              <p className="mt-2 text-sm text-[var(--color-ink-soft)] line-clamp-2">
                {topic.description}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs text-[var(--color-ink-soft)]">
              <span className="block uppercase tracking-wider">{topic.status}</span>
              <span className="mt-1 block">
                {topic.messageCount} messages
              </span>
            </div>
          </div>
        </Link>
      ))}
      {data?.topics.length === 0 && (
        <div className="rounded-3xl border border-black/10 bg-white/70 p-8 text-center text-[var(--color-ink-soft)]">
          No topics active right now.
        </div>
      )}
    </div>
  );
}
