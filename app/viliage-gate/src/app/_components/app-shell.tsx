"use client";

import Link from "next/link";
import { WalletConnectButton } from "@/app/_components/wallet-auth";

export function AppShell({
  children,
  title = "Murmur",
  subtitle = "Constructive signal for OpenGov",
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(17,75,95,0.12),_transparent_55%),radial-gradient(circle_at_20%_20%,_rgba(242,158,76,0.15),_transparent_45%),linear-gradient(120deg,_#f6f1e9,_#e7eef5)]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <Link href="/" className="text-xl font-semibold tracking-tight">
              {title}
            </Link>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">
              {subtitle}
            </p>
          </div>
          <nav className="flex items-center gap-4 text-sm text-[var(--color-ink-soft)]">
            <Link href="/spaces" className="hover:text-[var(--color-ink)]">
              Spaces
            </Link>
            <Link href="/wallet" className="hover:text-[var(--color-ink)]">
              VP
            </Link>
            <WalletConnectButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
