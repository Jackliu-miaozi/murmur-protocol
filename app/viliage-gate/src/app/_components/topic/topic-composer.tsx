"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export function MessageComposer({ topicId }: { topicId: number }) {
  const utils = api.useUtils();
  const [content, setContent] = useState("");
  const createMessage = api.message.post.useMutation({
    onSuccess: async () => {
      await utils.message.listByTopic.invalidate({ topicId });
      setContent("");
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        createMessage.mutate({ topicId, content });
      }}
      className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
          Share insight
        </p>
        <span className="text-xs text-[var(--color-ink-soft)]">
          VP cost calculated on submit
        </span>
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Offer concise, constructive feedback."
        className="mt-4 min-h-[120px] w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
        required
      />
      <button
        type="submit"
        className="mt-4 rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)]"
        disabled={createMessage.isPending}
      >
        {createMessage.isPending ? "Posting..." : "Post message"}
      </button>
    </form>
  );
}
