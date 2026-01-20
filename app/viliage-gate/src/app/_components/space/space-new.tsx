"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export function SpaceCreateForm() {
  const utils = api.useUtils();
  const createSpace = api.space.create.useMutation({
    onSuccess: async () => {
      await utils.space.list.invalidate();
      setName("");
      setTwitterHandle("");
      setDescription("");
    },
  });

  const [name, setName] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [description, setDescription] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        createSpace.mutate({
          name,
          twitterHandle: twitterHandle || undefined,
          description: description || undefined,
        });
      }}
      className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm"
    >
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
        Create space
      </p>
      <h2 className="mt-3 text-2xl font-semibold">Launch a project base</h2>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        Spaces organize the community around a single OpenGov proposal cycle.
      </p>
      <div className="mt-6 grid gap-4">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Space name"
          className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          required
        />
        <input
          value={twitterHandle}
          onChange={(event) => setTwitterHandle(event.target.value)}
          placeholder="Twitter handle (optional)"
          className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Short description"
          className="min-h-[120px] rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
        />
      </div>
      <button
        type="submit"
        className="mt-6 w-full rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)]"
        disabled={createSpace.isPending}
      >
        {createSpace.isPending ? "Creating..." : "Create space"}
      </button>
    </form>
  );
}
