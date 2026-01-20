"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export function TopicCreateForm({ spaceId }: { spaceId: number }) {
  const utils = api.useUtils();
  const createTopic = api.topic.create.useMutation({
    onSuccess: async () => {
      await utils.space.listTopics.invalidate({ spaceId });
      setTitle("");
      setDescription("");
    },
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        createTopic.mutate({
          title,
          description,
          duration: 86_400,
          freezeWindow: 900,
          curatedLimit: 50,
          spaceId,
        });
      }}
      className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm"
    >
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
        Launch topic
      </p>
      <h2 className="mt-3 text-2xl font-semibold">Start a new discussion</h2>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        10,000 VP service fee is charged on creation.
      </p>
      <div className="mt-6 grid gap-4">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Topic title"
          className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          required
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe what you want feedback on"
          className="min-h-[140px] rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          required
        />
      </div>
      <button
        type="submit"
        className="mt-6 w-full rounded-2xl bg-[var(--color-ink)] px-6 py-3 text-sm font-semibold text-white hover:bg-black"
        disabled={createTopic.isPending}
      >
        {createTopic.isPending ? "Creating..." : "Create topic"}
      </button>
    </form>
  );
}
