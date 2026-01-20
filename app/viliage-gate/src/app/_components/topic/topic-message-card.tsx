"use client";

import { api } from "@/trpc/react";

export function MessageCard({
  message,
}: {
  message: {
    id: number;
    content: string;
    author: string;
    likeCount: number;
    vpCost: string;
    createdAt: Date;
  };
}) {
  const utils = api.useUtils();
  const like = api.message.like.useMutation({
    onSuccess: async () => {
      await utils.message.listByTopic.invalidate();
      await utils.message.getCurated.invalidate();
    },
  });

  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm">
      <div className="flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
        <span>{message.author}</span>
        <span>{new Date(message.createdAt).toLocaleString()}</span>
      </div>
      <p className="mt-3 text-sm text-[var(--color-ink)]">{message.content}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
        <span>VP cost: {message.vpCost}</span>
        <button
          type="button"
          onClick={() => like.mutate({ messageId: message.id })}
          className="rounded-full border border-black/10 px-3 py-1 text-xs hover:border-[var(--color-accent)]"
          disabled={like.isPending}
        >
          {like.isPending ? "Liking..." : `Like (${message.likeCount})`}
        </button>
      </div>
    </div>
  );
}
