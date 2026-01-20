"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { SpaceCreateForm } from "@/app/_components/space/space-new";

export function SpaceList() {
  const { data, isLoading } = api.space.list.useQuery({ limit: 12 });

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-black/10 bg-white/70 p-8">
        <p className="text-[var(--color-ink-soft)]">Loading spaces...</p>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
              Spaces
            </p>
            <h2 className="text-2xl font-semibold">Active project bases</h2>
          </div>
          <p className="text-sm text-[var(--color-ink-soft)]">
            {data?.total ?? 0} total
          </p>
        </div>
        <div className="mt-6 grid gap-4">
          {data?.spaces.map((space) => (
            <Link
              key={space.id}
              href={`/spaces/${space.id}`}
              className="group rounded-2xl border border-black/5 bg-white/60 p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-accent)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-ink)]">
                    {space.name}
                  </h3>
                  <p className="text-sm text-[var(--color-ink-soft)]">
                    {space.twitterHandle
                      ? `@${space.twitterHandle}`
                      : "No social handle"}
                  </p>
                </div>
                <span className="text-sm text-[var(--color-accent)]">View -&gt;</span>
              </div>
              {space.description && (
                <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                  {space.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
      <SpaceCreateForm />
    </section>
  );
}
