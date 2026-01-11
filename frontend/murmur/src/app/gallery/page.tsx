"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Card, Badge, Spinner } from "@/components/ui";
import {
  useNFTMinter,
  useTopicFactory,
  useHasUserPostedInTopic,
  useNFTMetadata,
} from "@/lib/hooks";
import { TopicStatus } from "@/lib/contracts";
import { useAccount } from "wagmi";
import type { Topic } from "@/types";

// NFT Card Component
function NFTCard({ tokenId }: { tokenId: bigint }) {
  const { metadata, isLoading } = useNFTMetadata(tokenId);

  if (isLoading) {
    return (
      <Card className="flex min-h-[200px] items-center justify-center">
        <Spinner />
      </Card>
    );
  }

  if (!metadata) return null;

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  };

  return (
    <Card variant="gradient" className="overflow-hidden">
      {/* NFT Visual */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-purple-600/30 to-pink-600/30">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl">🔮</span>
        </div>
        <Badge variant="info" className="absolute right-2 top-2">
          #{tokenId.toString()}
        </Badge>
      </div>

      {/* NFT Info */}
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-white">
          Murmur Memory #{tokenId.toString()}
        </h3>
        <p className="mt-1 text-sm text-gray-400">
          Topic #{metadata.topicId.toString()}
        </p>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Version</span>
            <span className="text-white">{metadata.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Minted</span>
            <span className="text-white">{formatDate(metadata.mintedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Minter</span>
            <span className="text-white">
              {metadata.mintedBy.slice(0, 6)}...{metadata.mintedBy.slice(-4)}
            </span>
          </div>
        </div>

        <Link href={`/topics/${metadata.topicId}`}>
          <Button variant="outline" size="sm" className="mt-4 w-full">
            View Topic
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// Mintable Topic Card Component
function MintableTopicCard({ topic }: { topic: Topic }) {
  const { address } = useAccount();
  const { hasPosted } = useHasUserPostedInTopic(topic.topicId, address);
  const { mintNfts, isPending } = useNFTMinter();
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMint = async () => {
    setIsMinting(true);
    setError(null);
    try {
      await mintNfts(topic.topicId);
    } catch (err) {
      console.error("Mint failed:", err);
      setError(err instanceof Error ? err.message : "Failed to mint NFT");
    } finally {
      setIsMinting(false);
    }
  };

  const canMint = hasPosted && !topic.minted;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <Badge variant="warning">Closed</Badge>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Topic #{topic.topicId.toString()}
          </h3>
        </div>
        {canMint ? (
          <span className="text-2xl">✨</span>
        ) : (
          <span className="text-2xl opacity-50">🔒</span>
        )}
      </div>

      <p className="mt-2 text-sm text-gray-400">
        {topic.creator.slice(0, 8)}...{topic.creator.slice(-6)}
      </p>

      {error && (
        <div className="mt-4 rounded bg-red-500/20 p-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="mt-4">
        {canMint ? (
          <Button
            variant="primary"
            onClick={handleMint}
            isLoading={isMinting || isPending}
            disabled={isMinting || isPending}
            className="w-full"
          >
            🖼️ Mint NFT Memory
          </Button>
        ) : hasPosted === false ? (
          <p className="text-center text-sm text-gray-500">
            You must have posted in this topic to mint
          </p>
        ) : (
          <Link href={`/topics/${topic.topicId}`}>
            <Button variant="secondary" className="w-full">
              View Topic
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

export default function GalleryPage() {
  const { isConnected } = useAccount();
  const { topicCounter } = useTopicFactory();

  const [mintedTopics, setMintedTopics] = useState<Topic[]>([]);
  const [closedTopics, setClosedTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"minted" | "mintable">("minted");

  // Fetch all topics and categorize them
  useEffect(() => {
    const fetchTopics = async () => {
      if (!topicCounter) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const minted: Topic[] = [];
      const closed: Topic[] = [];

      // For demo, create placeholder topics
      // In production, you'd use multicall or batch queries
      const counter = Number(topicCounter);
      for (let i = 1; i <= counter; i++) {
        const placeholderTopic: Topic = {
          topicId: BigInt(i),
          creator:
            "0x0000000000000000000000000000000000000000" as `0x${string}`,
          metadataHash:
            "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
          createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 2),
          duration: BigInt(86400),
          freezeWindow: BigInt(600),
          curatedLimit: BigInt(50),
          status: i % 3 === 0 ? TopicStatus.Minted : TopicStatus.Closed,
          minted: i % 3 === 0,
        };

        if (placeholderTopic.status === TopicStatus.Minted) {
          minted.push(placeholderTopic);
        } else if (placeholderTopic.status === TopicStatus.Closed) {
          closed.push(placeholderTopic);
        }
      }

      setMintedTopics(minted);
      setClosedTopics(closed);
      setIsLoading(false);
    };

    void fetchTopics();
  }, [topicCounter]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">NFT Gallery</h1>
          <p className="mt-2 text-gray-400">
            Minted memories and topics ready to be preserved
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex justify-center gap-2">
          <Button
            variant={activeTab === "minted" ? "primary" : "secondary"}
            onClick={() => setActiveTab("minted")}
          >
            🖼️ Minted NFTs ({mintedTopics.length})
          </Button>
          <Button
            variant={activeTab === "mintable" ? "primary" : "secondary"}
            onClick={() => setActiveTab("mintable")}
          >
            ✨ Ready to Mint ({closedTopics.length})
          </Button>
        </div>

        {/* Content */}
        {activeTab === "minted" ? (
          <>
            {mintedTopics.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-white/20 p-8">
                <span className="text-6xl">🖼️</span>
                <p className="mt-4 text-xl text-gray-400">No NFTs minted yet</p>
                <p className="mt-2 text-sm text-gray-500">
                  Be the first to mint a topic memory!
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {mintedTopics.map((topic) => (
                  <NFTCard
                    key={topic.topicId.toString()}
                    tokenId={topic.topicId - 1n}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {!isConnected ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-white/20 p-8">
                <span className="text-6xl">🔐</span>
                <p className="mt-4 text-xl text-gray-400">
                  Connect wallet to mint
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  You need to connect your wallet to mint NFTs
                </p>
              </div>
            ) : closedTopics.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-white/20 p-8">
                <span className="text-6xl">⏳</span>
                <p className="mt-4 text-xl text-gray-400">
                  No topics ready to mint
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Wait for active topics to close
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {closedTopics.map((topic) => (
                  <MintableTopicCard
                    key={topic.topicId.toString()}
                    topic={topic}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Info Section */}
        <Card className="mt-12">
          <h3 className="mb-4 text-lg font-semibold text-white">
            About Murmur NFT Memories
          </h3>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li className="flex flex-col items-center text-center">
              <span className="text-3xl">📝</span>
              <p className="mt-2 text-sm text-gray-400">
                Each NFT contains the curated discussions from a closed topic
              </p>
            </li>
            <li className="flex flex-col items-center text-center">
              <span className="text-3xl">⭐</span>
              <p className="mt-2 text-sm text-gray-400">
                Only the top-voted messages are preserved in the NFT
              </p>
            </li>
            <li className="flex flex-col items-center text-center">
              <span className="text-3xl">🔄</span>
              <p className="mt-2 text-sm text-gray-400">
                Minting triggers VP refund for all participants
              </p>
            </li>
            <li className="flex flex-col items-center text-center">
              <span className="text-3xl">♾️</span>
              <p className="mt-2 text-sm text-gray-400">
                NFTs are stored forever on the blockchain
              </p>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
