import { AppShell } from "@/app/_components/app-shell";
import { SpaceList } from "@/app/_components/space/space-list";

export default function SpacesPage() {
  return (
    <AppShell title="Murmur Spaces" subtitle="Project bases for OpenGov">
      <div className="grid gap-8">
        <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
          <div className="flex flex-col gap-4">
            <p className="text-sm uppercase tracking-[0.35em] text-[var(--color-ink-soft)]">
              Entry
            </p>
            <h1 className="text-4xl font-semibold text-[var(--color-ink)]">
              Spaces are the project homes where proposals begin.
            </h1>
            <p className="max-w-2xl text-[var(--color-ink-soft)]">
              Create or join a Space, launch topics, and turn community feedback into
              OpenGov-ready signal.
            </p>
          </div>
        </section>
        <SpaceList />
      </div>
    </AppShell>
  );
}
