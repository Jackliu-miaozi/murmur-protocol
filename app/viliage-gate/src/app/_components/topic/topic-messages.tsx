"use client";

import { api } from "@/trpc/react";
import { MessageCard } from "@/app/_components/topic/topic-message-card";

export function MessageList({ topicId }: { topicId: number }) {
  const { data, isLoading } = api.message.listByTopic.useQuery({
    topicId,
    limit: 50,
  });

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/70 p-6">
        <p className="text-[var(--color-ink-soft)]">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {data?.messages.map((message) => (
        <MessageCard key={message.id} message={message} />
      ))}
      {data?.messages.length === 0 && (
        <div className="rounded-3xl border border-black/10 bg-white/70 p-6 text-[var(--color-ink-soft)]">
          No messages yet.
        </div>
      )}
    </div>
  );
}
