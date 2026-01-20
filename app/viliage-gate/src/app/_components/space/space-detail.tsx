"use client";

import { api } from "@/trpc/react";
import { TopicCreateForm } from "@/app/_components/space/topic-create";
import Link from "next/link";

export function SpaceDetail({ spaceId }: { spaceId: number }) {
  const { data: spaceData, isLoading: isSpaceLoading } =
    api.space.get.useQuery({ id: spaceId });
  const { data: topicsData, isLoading: isTopicLoading } =
    api.space.listTopics.useQuery({ spaceId, limit: 12 });

  if (isSpaceLoading) {
    return (
      <section className="rounded-3xl border border-black/10 bg-white/70 p-8">
        <p className="text-[var(--color-ink-soft)]">Loading space...</p>
      </section>
    );
  }

  if (!spaceData) {
    return (
      <section className="rounded-3xl border border-black/10 bg-white/70 p-8">
        <p className="text-[var(--color-ink-soft)]">Space not found.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
              Space
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{spaceData.space.name}</h1>
            <p className="text-sm text-[var(--color-ink-soft)]">
              {spaceData.space.twitterHandle
                ? `@${spaceData.space.twitterHandle}`
                : "No social handle"}
            </p>
          </div>
          <span className="rounded-full border border-black/10 px-3 py-1 text-xs text-[var(--color-ink-soft)]">
            Topics {topicsData?.total ?? 0}
          </span>
        </div>
        {spaceData.space.description && (
          <p className="mt-4 text-[var(--color-ink-soft)]">
            {spaceData.space.description}
          </p>
        )}
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Topic timeline</h2>
          <div className="mt-4 grid gap-4">
            {isTopicLoading && (
              <p className="text-[var(--color-ink-soft)]">Loading topics...</p>
            )}
            {topicsData?.topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.id}`}
                className="rounded-2xl border border-black/5 bg-white/70 p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-accent)]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{topic.title}</h3>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                    {topic.status}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                    {topic.openGovStatus}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  {topic.description}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-ink-soft)]">
                  <span>{topic.messageCount} messages</span>
                  <span>{topic.uniqueUsers} voices</span>
                </div>
              </Link>
            ))}
            {topicsData?.topics.length === 0 && !isTopicLoading && (
              <p className="text-[var(--color-ink-soft)]">No topics yet.</p>
            )}
          </div>
        </div>
      </section>
      <TopicCreateForm spaceId={spaceId} />
    </div>
  );
}
