import { Suspense } from "react";
import { TopicList } from "@/app/_components/post";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            <span className="text-[hsl(280,100%,70%)]">Murmur</span> Protocol
          </h1>

          <p className="text-center text-xl text-gray-300">
            Decentralized discussion platform with curated NFT memories
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl bg-white/10 p-6">
              <h3 className="mb-2 text-xl font-bold text-purple-400">
                💬 Discuss
              </h3>
              <p className="text-gray-300">
                Join topics, share insights, and engage with the community
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-6">
              <h3 className="mb-2 text-xl font-bold text-purple-400">
                ⭐ Curate
              </h3>
              <p className="text-gray-300">
                Like messages to vote for the best contributions
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-6">
              <h3 className="mb-2 text-xl font-bold text-purple-400">
                🎨 Mint
              </h3>
              <p className="text-gray-300">
                Preserve curated discussions as NFT memories
              </p>
            </div>
          </div>

          <Suspense
            fallback={<div className="text-gray-400">Loading topics...</div>}
          >
            <TopicList />
          </Suspense>
        </div>
      </main>
    </HydrateClient>
  );
}
