import { Suspense } from "react";
import Link from "next/link";
import { AppShell } from "@/app/_components/app-shell";
import { TopicList } from "@/app/_components/topic/topic-list";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <AppShell>
        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-black/10 bg-white/70 p-10 shadow-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-ink-soft)]">
              OpenGov signal
            </p>
            <h1 className="mt-4 text-5xl font-semibold text-[var(--color-ink)]">
              Coordinate the next proposal cycle with clarity.
            </h1>
            <p className="mt-4 max-w-xl text-[var(--color-ink-soft)]">
              Murmur connects project teams and participants through structured
              debate, curated insights, and verifiable community sentiment.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/spaces"
                className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)]"
              >
                Explore spaces
              </Link>
              <Link
                href="/wallet"
                className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-[var(--color-ink)]"
              >
                View VP energy
              </Link>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="rounded-3xl border border-black/10 bg-[var(--color-ink)] p-8 text-white shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                Dual view
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                Live Arena + Project Timeline
              </h2>
              <p className="mt-3 text-sm text-white/70">
                Combine social signal with structured debate and OpenGov outcomes.
              </p>
            </div>
            <div className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
                Rewards
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                VP-powered curation
              </h2>
              <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                Thoughtful feedback recovers VP, surfaces curated insight, and
                becomes a minted memory once landed.
              </p>
            </div>
          </div>
        </section>
        <section className="mt-12">
          <Suspense fallback={<div>Loading topics...</div>}>
            <TopicList />
          </Suspense>
        </section>
      </AppShell>
    </HydrateClient>
  );
}
