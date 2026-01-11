"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { useTopicFactory, useVPToken } from "@/lib/hooks";
import { uploadTopicMetadata, storeHashMapping } from "@/lib/ipfs";
import { useAccount } from "wagmi";
import { keccak256, toBytes } from "viem";

interface CreateTopicForm {
  title: string;
  description: string;
  durationHours: number;
  freezeWindowMinutes: number;
  curatedLimit: number;
}

const initialForm: CreateTopicForm = {
  title: "",
  description: "",
  durationHours: 24,
  freezeWindowMinutes: 10,
  curatedLimit: 50,
};

export default function CreateTopicPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { createTopic, creationCost, creationCostRaw, isPending } =
    useTopicFactory();
  const { vpBalance, vpBalanceRaw } = useVPToken();

  const [form, setForm] = useState<CreateTopicForm>(initialForm);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAfford =
    vpBalanceRaw && creationCostRaw
      ? vpBalanceRaw >= creationCostRaw
      : false;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    if (!canAfford) {
      setError("Insufficient VP balance");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // 1. Upload metadata to IPFS
      const metadata = {
        title: form.title,
        description: form.description,
        creator: address,
        createdAt: Date.now(),
      };

      const ipfsHash = await uploadTopicMetadata(metadata);

      // 2. Create metadata hash
      const metadataHash = keccak256(toBytes(ipfsHash));

      // 3. Store mapping for later retrieval
      storeHashMapping(metadataHash, ipfsHash);

      // 4. Convert form values to contract parameters
      const durationSeconds = BigInt(form.durationHours * 3600);
      const freezeWindowSeconds = BigInt(form.freezeWindowMinutes * 60);
      const curatedLimit = BigInt(form.curatedLimit);

      // 5. Create topic
      await createTopic(
        metadataHash,
        durationSeconds,
        freezeWindowSeconds,
        curatedLimit,
      );

      // 6. Redirect to home
      router.push("/");
    } catch (err) {
      console.error("Failed to create topic:", err);
      setError(err instanceof Error ? err.message : "Failed to create topic");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <span className="text-6xl">🔐</span>
        <h2 className="mt-4 text-2xl font-bold text-white">
          Connect Your Wallet
        </h2>
        <p className="mt-2 text-gray-400">
          You need to connect your wallet to create a topic
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Create New Topic</h1>
          <p className="mt-2 text-gray-400">
            Start a new discussion and mint it as an NFT when it ends
          </p>
        </div>

        <Card variant="gradient">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <Input
              label="Topic Title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g., Web3 Future Development Directions"
              required
            />

            {/* Description */}
            <Textarea
              label="Description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe what this topic is about and what kind of discussions you're looking for..."
              rows={4}
              required
            />

            {/* Duration */}
            <Input
              label="Duration (hours)"
              name="durationHours"
              type="number"
              value={form.durationHours}
              onChange={handleChange}
              min={1}
              max={168}
              required
            />

            {/* Freeze Window */}
            <Input
              label="Freeze Window (minutes)"
              name="freezeWindowMinutes"
              type="number"
              value={form.freezeWindowMinutes}
              onChange={handleChange}
              min={1}
              max={60}
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              The curated list will be locked during this time before the topic
              ends
            </p>

            {/* Curated Limit */}
            <Input
              label="Curated Messages Limit"
              name="curatedLimit"
              type="number"
              value={form.curatedLimit}
              onChange={handleChange}
              min={1}
              max={100}
              required
            />

            {/* Cost Summary */}
            <Card className="bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Creation Cost</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {Number(creationCost).toFixed(2)} VP
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Your Balance</p>
                  <p
                    className={`text-2xl font-bold ${
                      canAfford ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {Number(vpBalance).toFixed(2)} VP
                  </p>
                </div>
              </div>
              {!canAfford && (
                <p className="mt-4 text-sm text-red-400">
                  ⚠️ You need more VP to create this topic. Go to Assets page to
                  stake vDOT and get VP.
                </p>
              )}
            </Card>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-500/20 p-4 text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isCreating || isPending}
                disabled={!canAfford || isCreating || isPending}
                className="flex-1"
              >
                Create Topic
              </Button>
            </div>
          </form>
        </Card>

        {/* Info */}
        <Card className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-white">
            How It Works
          </h3>
          <ul className="space-y-3 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span>1️⃣</span>
              <span>
                Create a topic with VP tokens. The cost depends on the number of
                active topics.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>2️⃣</span>
              <span>
                Users can post messages and like others&apos; messages. Each action
                consumes VP.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>3️⃣</span>
              <span>
                The most liked messages become &quot;curated&quot; and are highlighted in
                the discussion.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>4️⃣</span>
              <span>
                When the topic ends, any participant can mint it as an NFT
                memory.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>5️⃣</span>
              <span>
                After minting, all participants get their VP refunded!
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
