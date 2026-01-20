"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { MessageComposer } from "@/app/_components/topic/topic-composer";
import { MessageList } from "@/app/_components/topic/topic-messages";
import { CuratedPanel } from "@/app/_components/topic/topic-curated";
import { WalletPanel } from "@/app/_components/wallet/wallet-panel";
import { VpHistoryMini } from "@/app/_components/wallet/vp-history-mini";
import { TopicActions } from "@/app/_components/topic/topic-actions";

export function TopicArena({ topicId }: { topicId: number }) {
  const { data: topicData, isLoading } = api.topic.get.useQuery({ id: topicId });

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-black/10 bg-white/70 p-8">
        <p className="text-[var(--color-ink-soft)]">Loading topic...</p>
      </section>
    );
  }

  if (!topicData) {
    return (
      <section className="rounded-3xl border border-black/10 bg-white/70 p-8">
        <p className="text-[var(--color-ink-soft)]">Topic not found.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
              Live Arena
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{topicData.title}</h1>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              {topicData.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-soft)]">
              <span className="rounded-full border border-black/10 px-3 py-1 uppercase tracking-[0.2em]">
                {topicData.status}
              </span>
              <span className="rounded-full border border-black/10 px-3 py-1 uppercase tracking-[0.2em]">
                OpenGov {topicData.openGovStatus}
              </span>
              <Link
                href={`/topics/${topicId}/opengov`}
                className="rounded-full border border-black/10 px-3 py-1 text-[var(--color-ink)]"
              >
                OpenGov panel
              </Link>
            </div>
          </div>
          <TopicActions topicId={topicId} status={topicData.status} />
        </div>
        <div className="mt-8 grid gap-6">
          <MessageComposer topicId={topicId} />
          <MessageList topicId={topicId} />
        </div>
      </section>
      <aside className="grid gap-6">
        <WalletPanel />
        <VpHistoryMini />
        <CuratedPanel topicId={topicId} />
        <div className="rounded-3xl border border-black/10 bg-[var(--color-ink)] p-6 text-white shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">
            Momentum
          </p>
          <p className="mt-3 text-sm text-white/70">
            Track discussion energy, curated consensus, and when the topic
            approaches its freeze window.
          </p>
        <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm">
          Messages: {topicData.messageCount} | Voices: {topicData.uniqueUsers}
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
          Freeze starts: {topicData.freezeStartMs ? new Date(topicData.freezeStartMs).toLocaleString() : "-"}
          <br />
          Ends: {topicData.endMs ? new Date(topicData.endMs).toLocaleString() : "-"}
        </div>

        </div>
      </aside>
    </div>
  );
}
