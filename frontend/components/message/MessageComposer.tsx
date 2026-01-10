'use client'

import { useState, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { usePostMessage } from '@/lib/hooks/useMessageRegistry'
import { uploadMessageContent, generateContentHash } from '@/lib/ipfs'
import axios from 'axios'

interface MessageComposerProps {
  topicId: number
  onMessagePosted?: () => void
}

export function MessageComposer({ topicId, onMessagePosted }: MessageComposerProps) {
  const { address, isConnected } = useAccount()
  const [message, setMessage] = useState('')
  const [estimatedCost, setEstimatedCost] = useState<string>('')

  const { postMessage, isLoading, isSuccess } = usePostMessage()

  useEffect(() => {
    if (isSuccess && onMessagePosted) {
      setMessage('')
      onMessagePosted()
    }
  }, [isSuccess, onMessagePosted])

  const handlePost = async () => {
    if (!isConnected || !message.trim()) return

    try {
      // 1. Upload message to IPFS
      const messageContent = {
        text: message,
        author: address!,
        timestamp: Math.floor(Date.now() / 1000),
      }
      
      const ipfsHash = await uploadMessageContent(messageContent)
      const contentHash = generateContentHash(ipfsHash)

      // 2. Get AI score and signature
      const aiResponse = await axios.post('/api/ai-score', {
        content: message,
        length: message.length,
      })

      const { score, timestamp, signature } = aiResponse.data

      // 3. Post message to contract
      postMessage(
        topicId,
        contentHash,
        message.length,
        BigInt(score),
        timestamp,
        signature
      )
    } catch (error) {
      console.error('Failed to post message:', error)
      alert('Failed to post message: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  if (!isConnected) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Connect your wallet to post messages
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Share your thoughts..."
        className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        disabled={isLoading}
      />
      
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {message.length} characters
          {estimatedCost && ` • Est. cost: ${estimatedCost} VP`}
        </div>
        <Button onClick={handlePost} disabled={isLoading || !message.trim()}>
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Posting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Post Message
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
