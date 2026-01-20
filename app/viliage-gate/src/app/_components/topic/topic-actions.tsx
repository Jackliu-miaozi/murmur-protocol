"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/trpc/react";

export function TopicActions({
  topicId,
  status,
}: {
  topicId: number;
  status: string;
}) {
  const utils = api.useUtils();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const closeTopic = api.topic.close.useMutation({
    onSuccess: async () => {
      await utils.topic.get.invalidate({ id: topicId });
      setNotice("Topic closed.");
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setNotice(null);
    },
  });
  const landTopic = api.topic.land.useMutation({
    onSuccess: async () => {
      await utils.topic.get.invalidate({ id: topicId });
      setNotice("Topic landed.");
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setNotice(null);
    },
  });

  return (
    <div className="flex flex-col items-end gap-3">
      {notice && <span className="text-xs text-[var(--color-ink-soft)]">{notice}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-[var(--color-ink)]"
        onClick={() => {
          if (!window.confirm("Close this topic?")) return;
          closeTopic.mutate({ id: topicId });
        }}
        disabled={closeTopic.isPending || status !== "LIVE"}
      >
        {closeTopic.isPending ? "Closing..." : "Close topic"}
      </button>
      <button
        type="button"
        className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold text-white"
        onClick={() => {
          if (!window.confirm("Land this topic?")) return;
          landTopic.mutate({ id: topicId });
        }}
        disabled={landTopic.isPending || status !== "CLOSED"}
      >
        {landTopic.isPending ? "Landing..." : "Land topic"}
      </button>
      {status === "LANDED" ? (
        <Link
          href={`/topics/${topicId}/mint`}
          className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-[var(--color-ink)]"
        >
          Mint NFT
        </Link>
      ) : (
        <span className="text-xs text-[var(--color-ink-soft)]">
          Mint available after landing
        </span>
      )}
    </div>
  );
}
