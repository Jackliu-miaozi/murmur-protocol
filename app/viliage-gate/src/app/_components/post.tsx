"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export function TopicList() {
  const { data: topicsData, isLoading } = api.topic.list.useQuery({
    limit: 10,
  });

  const utils = api.useUtils();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const createTopic = api.topic.create.useMutation({
    onSuccess: async () => {
      await utils.topic.invalidate();
      setTitle("");
      setDescription("");
    },
  });

  if (isLoading) {
    return <div className="text-white">Loading topics...</div>;
  }

  return (
    <div className="w-full max-w-md">
      <h2 className="mb-4 text-xl font-bold text-white">Topics</h2>

      {/* Topic List */}
      <div className="mb-6 space-y-2">
        {topicsData?.topics.map((topic) => (
          <div key={topic.id} className="rounded-lg bg-white/10 p-4 text-white">
            <h3 className="font-semibold">{topic.title}</h3>
            <p className="text-sm text-gray-300">
              Status: {topic.status} | Messages: {topic.messageCount}
            </p>
          </div>
        ))}
        {topicsData?.topics.length === 0 && (
          <p className="text-gray-400">No topics yet.</p>
        )}
      </div>

      {/* Create Topic Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createTopic.mutate({
            title,
            description,
            duration: 86400, // 24 hours
            freezeWindow: 600, // 10 minutes
            curatedLimit: 50,
            creator: "0x0000000000000000000000000000000000000001", // Mock address
          });
        }}
        className="flex flex-col gap-2"
      >
        <input
          type="text"
          placeholder="Topic Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg bg-white/10 px-4 py-2 text-white placeholder-gray-400"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg bg-white/10 px-4 py-2 text-white placeholder-gray-400"
          rows={3}
        />
        <button
          type="submit"
          className="rounded-lg bg-purple-600 px-6 py-2 font-semibold text-white transition hover:bg-purple-700"
          disabled={createTopic.isPending}
        >
          {createTopic.isPending ? "Creating..." : "Create Topic"}
        </button>
      </form>
    </div>
  );
}
