'use client'

import { useEffect, useState } from 'react'
import { Heart, User } from 'lucide-react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { useGetMessagesByTopic, useLikeMessage } from '@/lib/hooks/useMessageRegistry'
import { getFromIPFS } from '@/lib/ipfs'
import { formatAddress } from '@/lib/utils'
import type { MessageContent } from '@/types'

interface MessageListProps {
  topicId: number
}

export function MessageList({ topicId }: MessageListProps) {
  const { isConnected } = useAccount()
  const [messageContents, setMessageContents] = useState<Map<number, MessageContent>>(new Map())
  
  const { data: messages, refetch } = useGetMessagesByTopic(topicId, 0, 50)
  const { likeMessage, isLoading: isLiking, isSuccess: likeSuccess } = useLikeMessage()

  useEffect(() => {
    if (likeSuccess) {
      refetch()
    }
  }, [likeSuccess, refetch])

  useEffect(() => {
    if (messages) {
      // Load message contents from IPFS
      const loadContents = async () => {
        for (const msg of messages as any[]) {
          if (!messageContents.has(Number(msg.id || 0))) {
            try {
              const content = await getFromIPFS<MessageContent>(msg.contentHash)
              setMessageContents(prev => new Map(prev).set(Number(msg.id || 0), content))
            } catch (error) {
              console.error('Failed to load message content:', error)
            }
          }
        }
      }
      loadContents()
    }
  }, [messages])

  const handleLike = (messageId: number) => {
    if (!isConnected || isLiking) return
    likeMessage(topicId, messageId)
  }

  if (!messages || (messages as any[]).length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No messages yet. Be the first to post!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {(messages as any[]).map((message, index) => {
        const content = messageContents.get(index)
        return (
          <div key={index} className="border rounded-lg p-4 hover:bg-accent/5 transition-colors">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 rounded-full p-2">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {formatAddress(message.author || '')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp ? new Date(Number(message.timestamp) * 1000).toLocaleString() : ''}
                  </span>
                </div>
                <p className="text-sm mb-2 whitespace-pre-wrap break-words">
                  {content?.text || 'Loading...'}
                </p>
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLike(index)}
                    disabled={isLiking}
                    className="h-8 gap-1"
                  >
                    <Heart className="h-4 w-4" />
                    <span>{Number(message.likeCount || 0)}</span>
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    VP Cost: {message.vpCost ? formatBalance(BigInt(message.vpCost.toString())) : '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatBalance(balance: bigint): string {
  const divisor = BigInt(1e18)
  const whole = balance / divisor
  return whole.toString()
}
