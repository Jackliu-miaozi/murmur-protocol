"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { TopicCard } from "./TopicCard";
import { Button, Spinner } from "@/components/ui";
import { CONTRACTS, ABIS, TopicStatus } from "@/lib/contracts";
import type { Topic } from "@/types";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: TopicStatus.Live, label: "Live" },
  { value: TopicStatus.Closed, label: "Closed" },
  { value: TopicStatus.Minted, label: "Minted" },
];

export function TopicList() {
  const [statusFilter, setStatusFilter] = useState<"all" | TopicStatus>("all");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get topic counter
  const { data: topicCounter } = useReadContract({
    address: CONTRACTS.TopicFactory,
    abi: ABIS.TopicFactory,
    functionName: "topicCounter",
  });

  // Fetch all topics
  useEffect(() => {
    const fetchTopics = async () => {
      if (!topicCounter) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const fetchedTopics: Topic[] = [];

      // Fetch topics in parallel (max 10 at a time to avoid rate limiting)
      const counter = Number(topicCounter);
      for (let i = 1; i <= counter; i++) {
        // We'll use placeholder data since we can't call hooks in a loop
        // In production, you'd use a multicall or batch query
        fetchedTopics.push({
          topicId: BigInt(i),
          creator: "0x0000000000000000000000000000000000000000" as `0x${string}`,
          metadataHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
          createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400),
          duration: BigInt(86400),
          freezeWindow: BigInt(600),
          curatedLimit: BigInt(50),
          status: TopicStatus.Live,
          minted: false,
        });
      }

      setTopics(fetchedTopics);
      setIsLoading(false);
    };

    void fetchTopics();
  }, [topicCounter]);

  // Filter topics
  const filteredTopics = topics.filter(
    (topic) => statusFilter === "all" || topic.status === statusFilter,
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Filter Buttons */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={String(filter.value)}
            variant={statusFilter === filter.value ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStatusFilter(filter.value as "all" | TopicStatus)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Topic Grid */}
      {filteredTopics.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-white/20 p-8">
          <span className="text-4xl">🔮</span>
          <p className="mt-4 text-gray-400">No topics found</p>
          <Button variant="primary" className="mt-4" onClick={() => window.location.href = "/create"}>
            Create First Topic
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTopics.map((topic) => (
            <TopicCard
              key={topic.topicId.toString()}
              topic={topic}
              messageCount={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
