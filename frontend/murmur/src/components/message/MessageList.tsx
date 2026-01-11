"use client";

import { MessageItem } from "./MessageItem";
import { Spinner } from "@/components/ui";
import { useTopicMessages, useCuratedMessages } from "@/lib/hooks";

interface MessageListProps {
  topicId: bigint;
  showCuratedOnly?: boolean;
}

export function MessageList({
  topicId,
  showCuratedOnly = false,
}: MessageListProps) {
  const { messages, isLoading, refetch } = useTopicMessages(topicId, 0n, 100n);
  const { messageIds: curatedIds } = useCuratedMessages(topicId);

  // Create a set of curated message IDs for quick lookup
  const curatedSet = new Set(
    curatedIds?.map((id) => id.toString()) ?? [],
  );

  // Filter messages if showing curated only
  const displayMessages = showCuratedOnly
    ? messages?.filter((m) => curatedSet.has(m.messageId.toString()))
    : messages;

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!displayMessages || displayMessages.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-white/20 p-8">
        <span className="text-4xl">💬</span>
        <p className="mt-4 text-gray-400">
          {showCuratedOnly
            ? "No curated messages yet"
            : "No messages yet. Be the first to share!"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayMessages.map((message) => (
        <MessageItem
          key={message.messageId.toString()}
          message={message}
          isCurated={curatedSet.has(message.messageId.toString())}
          onLiked={refetch}
        />
      ))}
    </div>
  );
}
