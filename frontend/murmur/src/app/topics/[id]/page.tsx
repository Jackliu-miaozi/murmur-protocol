"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Badge, Spinner } from "@/components/ui";
import { MessageList, MessageComposer } from "@/components/message";
import {
  useTopic,
  useMessageCount,
  useCuratedMessages,
  useNFTMinter,
  useHasUserPostedInTopic,
} from "@/lib/hooks";
import { useReadContract } from "wagmi";
import { CONTRACTS, ABIS, TopicStatus, TOPIC_STATUS_LABELS } from "@/lib/contracts";
import { useAccount } from "wagmi";

type TabType = "all" | "curated";

export default function TopicDetailPage() {
  const params = useParams();
  const { address } = useAccount();

  const topicId = params.id ? BigInt(params.id as string) : undefined;

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Fetch topic data
  const { topic, isLoading: isLoadingTopic, refetch: refetchTopic } = useTopic(topicId);
  const { count: messageCount, refetch: refetchCount } = useMessageCount(topicId);
  const { messageIds: curatedIds } = useCuratedMessages(topicId);

  // Check if frozen
  const { data: isFrozen } = useReadContract({
    address: CONTRACTS.TopicFactory,
    abi: ABIS.TopicFactory,
    functionName: "isFrozen",
    args: topicId !== undefined ? [topicId] : undefined,
    query: {
      enabled: topicId !== undefined,
    },
  });

  // Check if user can mint
  const { hasPosted } = useHasUserPostedInTopic(topicId, address);
  const { mintNfts, isPending: isMinting } = useNFTMinter();

  // Calculate remaining time
  useEffect(() => {
    if (!topic) return;

    const calculateRemaining = () => {
      const endTime = Number(topic.createdAt) + Number(topic.duration);
      const now = Math.floor(Date.now() / 1000);
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimeRemaining("Ended");
        return;
      }

      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [topic]);

  const handleMessagePosted = () => {
    void refetchCount();
  };

  const handleMintNFT = async () => {
    if (!topicId) return;
    try {
      await mintNfts(topicId);
      void refetchTopic();
    } catch (error) {
      console.error("Failed to mint NFT:", error);
    }
  };

  const getStatusBadgeVariant = (status: TopicStatus) => {
    switch (status) {
      case TopicStatus.Live:
        return "success";
      case TopicStatus.Closed:
        return "warning";
      case TopicStatus.Minted:
        return "info";
      default:
        return "default";
    }
  };

  if (isLoadingTopic) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <span className="text-6xl">🔍</span>
        <h2 className="mt-4 text-2xl font-bold text-white">Topic Not Found</h2>
        <p className="mt-2 text-gray-400">
          This topic doesn&apos;t exist or has been removed.
        </p>
        <Link href="/">
          <Button variant="primary" className="mt-6">
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Topic Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-purple-900/20 to-pink-900/20">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Badge variant={getStatusBadgeVariant(topic.status)}>
                  {TOPIC_STATUS_LABELS[topic.status]}
                </Badge>
                {Boolean(isFrozen) && (
                  <Badge variant="warning">🔒 Frozen</Badge>
                )}
              </div>
              <h1 className="mt-4 text-3xl font-bold text-white">
                Topic #{topic.topicId.toString()}
              </h1>
              <p className="mt-2 text-gray-400">
                Created by {topic.creator.slice(0, 8)}...{topic.creator.slice(-6)}
              </p>
            </div>

            {topic.status === TopicStatus.Live && (
              <div className="text-right">
                <p className="text-sm text-gray-400">Time Remaining</p>
                <p className="text-2xl font-bold text-purple-400">
                  {timeRemaining}
                </p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <Card className="text-center">
              <p className="text-2xl font-bold text-white">
                {messageCount?.toString() ?? "0"}
              </p>
              <p className="text-sm text-gray-400">Messages</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-purple-400">
                {curatedIds?.length ?? 0}
              </p>
              <p className="text-sm text-gray-400">Curated</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-white">
                {Number(topic.curatedLimit)}
              </p>
              <p className="text-sm text-gray-400">Curated Limit</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-white">
                {Math.floor(Number(topic.freezeWindow) / 60)}m
              </p>
              <p className="text-sm text-gray-400">Freeze Window</p>
            </Card>
          </div>

          {/* Actions */}
          {topic.status === TopicStatus.Closed && !topic.minted && hasPosted && (
            <div className="mt-6">
              <Button
                variant="primary"
                size="lg"
                onClick={handleMintNFT}
                isLoading={isMinting}
              >
                🖼️ Mint NFT Memory
              </Button>
              <p className="mt-2 text-sm text-gray-400">
                As a participant, you can mint this topic as an NFT
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Message Composer (only for Live topics) */}
        {topic.status === TopicStatus.Live && !Boolean(isFrozen) && (
          <div className="mb-8">
            <MessageComposer
              topicId={topic.topicId}
              onMessagePosted={handleMessagePosted}
            />
          </div>
        )}

        {topic.status === TopicStatus.Live && Boolean(isFrozen) && (
          <Card variant="outline" className="mb-8 border-yellow-500/50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="font-semibold text-yellow-400">
                  Topic is Frozen
                </p>
                <p className="text-sm text-gray-400">
                  The curated list is now locked. You can still post messages
                  and like, but the curated selection won&apos;t change.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-white/10 pb-4">
          <Button
            variant={activeTab === "all" ? "primary" : "ghost"}
            onClick={() => setActiveTab("all")}
          >
            💬 All Messages ({messageCount?.toString() ?? 0})
          </Button>
          <Button
            variant={activeTab === "curated" ? "primary" : "ghost"}
            onClick={() => setActiveTab("curated")}
          >
            ⭐ Curated ({curatedIds?.length ?? 0})
          </Button>
        </div>

        {/* Message List */}
        <MessageList topicId={topic.topicId} showCuratedOnly={activeTab === "curated"} />
      </div>
    </div>
  );
}
