'use client'

import { useEffect, useState } from 'react'
import { Trophy, User } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useGetMessagesByTopic } from '@/lib/hooks/useMessageRegistry'
import { getFromIPFS } from '@/lib/ipfs'
import { formatAddress } from '@/lib/utils'
import type { MessageContent } from '@/types'

interface CuratedMessagesProps {
  topicId: number
}

export function CuratedMessages({ topicId }: CuratedMessagesProps) {
  const { isConnected } = useAccount()
  const [messageContents, setMessageContents] = useState<Map<number, MessageContent>>(new Map())
  
  const { data: allMessages } = useGetMessagesByTopic(topicId, 0, 100)

  // Sort by like count and take top 10
  const messages = allMessages 
    ? (allMessages as any[])
        .sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0))
        .slice(0, 10)
    : []

  useEffect(() => {
    if (messages.length > 0) {
      const loadContents = async () => {
        for (const msg of messages) {
          const idx = Number(msg.id || 0)
          if (!messageContents.has(idx)) {
            try {
              const content = await getFromIPFS<MessageContent>(msg.contentHash)
              setMessageContents(prev => new Map(prev).set(idx, content))
            } catch (error) {
              console.error('Failed to load message content:', error)
            }
          }
        }
      }
      loadContents()
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="text-center py-4">
        <Trophy className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No curated messages yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {messages.map((message, index) => {
        const content = messageContents.get(Number(message.id || 0))
        return (
          <div key={index} className="border rounded-lg p-3 bg-accent/5">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {index + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium">
                    {formatAddress(message.author || '', 3)}
                  </span>
                </div>
                <p className="text-sm mb-2 line-clamp-3">
                  {content?.text || 'Loading...'}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Trophy className="h-3 w-3" />
                  <span>{Number(message.likeCount || 0)} likes</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
