"use client";

import Link from "next/link";
import { TopicList } from "@/components/topic";
import { Button, Card } from "@/components/ui";
import { useTopicFactory, useVPToken } from "@/lib/hooks";
import { useAccount } from "wagmi";

export default function HomePage() {
  const { isConnected } = useAccount();
  const { topicCounter, activeTopicCount, creationCost, isLoading } =
    useTopicFactory();
  const { vpBalance } = useVPToken();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-white/10 bg-gradient-to-r from-purple-900/20 to-pink-900/20">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Welcome to <span className="text-purple-400">Murmur</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
              Decentralized discussions with lasting memories. Create topics,
              share ideas, and mint your conversations as NFTs.
            </p>

            {isConnected ? (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link href="/create">
                  <Button variant="primary" size="lg">
                    ✨ Create Topic
                  </Button>
                </Link>
                <Link href="/assets">
                  <Button variant="secondary" size="lg">
                    💎 Manage VP
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="mt-8 text-gray-500">
                Connect your wallet to start participating
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <Card variant="gradient" className="text-center">
              <p className="text-3xl font-bold text-white">
                {isLoading ? "..." : Number(topicCounter ?? 0)}
              </p>
              <p className="mt-1 text-sm text-gray-400">Total Topics</p>
            </Card>
            <Card variant="gradient" className="text-center">
              <p className="text-3xl font-bold text-green-400">
                {isLoading ? "..." : Number(activeTopicCount ?? 0)}
              </p>
              <p className="mt-1 text-sm text-gray-400">Active Topics</p>
            </Card>
            <Card variant="gradient" className="text-center">
              <p className="text-3xl font-bold text-purple-400">
                {isLoading ? "..." : `${Number(creationCost).toFixed(0)} VP`}
              </p>
              <p className="mt-1 text-sm text-gray-400">Creation Cost</p>
            </Card>
          </div>
        </div>
      </div>

      {/* Topic List Section */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Topics</h2>
          {isConnected && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Your VP:</span>
              <span className="font-bold text-purple-400">
                {Number(vpBalance).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <TopicList />
      </div>
    </div>
  );
}
