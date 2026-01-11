"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge } from "@/components/ui";
import { useMessageRegistry } from "@/lib/hooks";
import { fetchMessageContent, getIpfsHash } from "@/lib/ipfs";
import type { Message, MessageContent } from "@/types";
import { formatEther } from "viem";

interface MessageItemProps {
  message: Message;
  isCurated?: boolean;
  onLiked?: () => void;
}

export function MessageItem({
  message,
  isCurated = false,
  onLiked,
}: MessageItemProps) {
  const { likeMessage, isPending } = useMessageRegistry();
  const [isLiking, setIsLiking] = useState(false);
  const [messageContent, setMessageContent] = useState<MessageContent | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [contentError, setContentError] = useState<string | null>(null);

  const handleLike = async () => {
    setIsLiking(true);
    try {
      await likeMessage(message.topicId, message.messageId);
      onLiked?.();
    } catch (error) {
      console.error("Failed to like message:", error);
    } finally {
      setIsLiking(false);
    }
  };

  const formatTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  const formatAIScore = (score: bigint) => {
    // Score is scaled to 1e18, so divide to get 0-1 range
    const normalizedScore = Number(score) / 1e18;
    return (normalizedScore * 100).toFixed(0) + "%";
  };

  // Fetch message content from IPFS
  useEffect(() => {
    const loadContent = async () => {
      if (!message.contentHash) {
        setIsLoadingContent(false);
        return;
      }

      setIsLoadingContent(true);
      setContentError(null);

      try {
        // Try to get IPFS hash from mapping (stored when message was posted)
        let ipfsHash = getIpfsHash(message.contentHash);
        
        if (!ipfsHash) {
          // If mapping not found, try to fetch from API (which may query chain events)
          try {
            const response = await fetch(
              `/api/ipfs/get?contentHash=${message.contentHash}`,
            );
            if (response.ok) {
              const data = (await response.json()) as {
                content?: MessageContent;
                ipfsHash?: string;
              };
              if (data.content) {
                setMessageContent(data.content);
                setIsLoadingContent(false);
                return;
              }
              if (data.ipfsHash) {
                ipfsHash = data.ipfsHash;
                // Store the mapping for future use
                storeHashMapping(message.contentHash, ipfsHash);
              }
            }
          } catch (apiError) {
            console.warn("API lookup failed, using local mapping only:", apiError);
          }
        }
        
        if (ipfsHash) {
          // Fetch content from IPFS
          const content = await fetchMessageContent(ipfsHash);
          setMessageContent(content);
        } else {
          // If still not found, show error
          console.warn(
            `IPFS hash mapping not found for contentHash: ${message.contentHash}. ` +
            `This message was likely posted before the mapping was stored.`
          );
          setContentError("Content mapping not found");
        }
      } catch (error) {
        console.error("Failed to fetch message content from IPFS:", error);
        setContentError(
          error instanceof Error ? error.message : "Failed to load content",
        );
      } finally {
        setIsLoadingContent(false);
      }
    };

    void loadContent();
  }, [message.contentHash]);

  return (
    <Card
      variant={isCurated ? "gradient" : "default"}
      className={`relative ${isCurated ? "border-purple-500/50" : ""}`}
    >
      {isCurated && (
        <Badge variant="info" className="absolute -top-2 right-4">
          ⭐ Curated
        </Badge>
      )}

      {/* Author & Time */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          👤 {message.author.slice(0, 6)}...{message.author.slice(-4)}
        </span>
        <span className="text-gray-500">{formatTime(message.timestamp)}</span>
      </div>

      {/* Message Content */}
      <div className="mt-3">
        {isLoadingContent ? (
          <p className="text-gray-500 italic">Loading content...</p>
        ) : contentError ? (
          <p className="text-gray-500 italic">
            Message #{message.messageId.toString()} - {contentError}
          </p>
        ) : messageContent ? (
          <p className="text-white whitespace-pre-wrap break-words">
            {messageContent.content}
          </p>
        ) : (
          <p className="text-gray-500 italic">
            Message #{message.messageId.toString()} - Content not available
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>🔥 AI Score: {formatAIScore(message.aiScore)}</span>
          <span>💰 Cost: {Number(formatEther(message.vpCost)).toFixed(2)} VP</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            ❤️ {message.likeCount.toString()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            isLoading={isLiking || isPending}
            disabled={isLiking || isPending}
          >
            {isLiking ? "..." : "Like"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
