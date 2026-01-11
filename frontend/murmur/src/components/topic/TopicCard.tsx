"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { Badge } from "@/components/ui";
import {
  TopicStatus,
  TOPIC_STATUS_LABELS,
} from "@/lib/contracts";
import type { Topic, TopicMetadata } from "@/types";
import { useEffect, useState } from "react";

interface TopicCardProps {
  topic: Topic;
  messageCount?: number;
}

export function TopicCard({ topic, messageCount = 0 }: TopicCardProps) {
  const [metadata, setMetadata] = useState<TopicMetadata | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Fetch metadata from IPFS
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        // In production, you'd convert the metadataHash to IPFS CID
        // For now, we'll use placeholder data
        setMetadata({
          title: `Topic #${topic.topicId}`,
          description: "Loading description...",
          creator: topic.creator,
          createdAt: Number(topic.createdAt) * 1000,
        });
      } catch (error) {
        console.error("Failed to fetch metadata:", error);
      }
    };

    void fetchMetadata();
  }, [topic.metadataHash, topic.topicId, topic.creator, topic.createdAt]);

  // Calculate remaining time
  useEffect(() => {
    const calculateRemaining = () => {
      const endTime =
        Number(topic.createdAt) + Number(topic.duration);
      const now = Math.floor(Date.now() / 1000);
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimeRemaining("Ended");
        return;
      }

      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeRemaining(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 60000);
    return () => clearInterval(interval);
  }, [topic.createdAt, topic.duration]);

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

  return (
    <Link href={`/topics/${topic.topicId}`}>
      <Card className="h-full cursor-pointer transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
        <div className="flex items-start justify-between">
          <Badge variant={getStatusBadgeVariant(topic.status)}>
            {TOPIC_STATUS_LABELS[topic.status]}
          </Badge>
          {topic.status === TopicStatus.Live && (
            <span className="text-sm text-gray-400">
              ⏱️ {timeRemaining}
            </span>
          )}
        </div>

        <h3 className="mt-4 text-lg font-semibold text-white">
          {metadata?.title ?? `Topic #${topic.topicId}`}
        </h3>

        <p className="mt-2 line-clamp-2 text-sm text-gray-400">
          {metadata?.description ?? "Loading..."}
        </p>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>💬 {messageCount} messages</span>
          <span>
            👤 {topic.creator.slice(0, 6)}...{topic.creator.slice(-4)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span>📊 Curated: {Number(topic.curatedLimit)}</span>
          <span>
            🔒 Freeze: {Math.floor(Number(topic.freezeWindow) / 60)}m
          </span>
        </div>
      </Card>
    </Link>
  );
}
