"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet";
import { useVPToken } from "@/lib/hooks";
import { useAccount } from "wagmi";

const navItems = [
  { href: "/", label: "Topics", icon: "💬" },
  { href: "/create", label: "Create", icon: "✨" },
  { href: "/assets", label: "Assets", icon: "💎" },
  { href: "/gallery", label: "Gallery", icon: "🖼️" },
];

export function Navigation() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { vpBalance, isLoading } = useVPToken();

  return (
    <nav className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-[#1a1a2e]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🔮</span>
            <span className="text-xl font-bold text-white">Murmur</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-purple-600 text-white"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Side: VP Balance + Wallet */}
          <div className="flex items-center gap-4">
            {isConnected && (
              <div className="hidden items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-4 py-2 sm:flex">
                <span className="text-sm text-gray-400">VP</span>
                <span className="font-bold text-white">
                  {isLoading ? "..." : Number(vpBalance).toFixed(2)}
                </span>
              </div>
            )}
            <WalletButton />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="border-t border-white/10 md:hidden">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs ${
                  isActive
                    ? "text-purple-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
