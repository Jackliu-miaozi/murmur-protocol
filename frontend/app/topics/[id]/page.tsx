'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Flame, MessageSquare, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WalletButton } from '@/components/wallet/WalletButton'
import { MessageList } from '@/components/message/MessageList'
import { MessageComposer } from '@/components/message/MessageComposer'
import { CuratedMessages } from '@/components/message/CuratedMessages'
import { topicFactoryContract } from '@/lib/contracts'
import { useWalletStore } from '@/lib/stores/walletStore'
import { formatTimeRemaining } from '@/lib/utils'
import type { Topic } from '@/types'

export default function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { selectedAccount } = useWalletStore()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTopic()
  }, [id, selectedAccount])

  const loadTopic = async () => {
    if (!selectedAccount) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const topicData = await topicFactoryContract.getTopic(
        parseInt(id),
        selectedAccount.address
      )
      setTopic(topicData)
    } catch (error) {
      console.error('Failed to load topic:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading topic...</p>
        </div>
      </div>
    )
  }

  if (!topic) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/topics" className="flex items-center gap-2">
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Topics</span>
            </Link>
            <WalletButton />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Topic Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                The topic you're looking for doesn't exist or you need to connect your wallet.
              </p>
              <Link href="/topics">
                <Button>View All Topics</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/topics" className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Topics</span>
          </Link>
          <WalletButton />
        </div>
      </header>

      {/* Topic Info Bar */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-4">Topic #{topic.id}</h1>
            
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatTimeRemaining(topic.endTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>{topic.messageCount} messages</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{topic.participantCount} participants</span>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span>Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Message Feed */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Message Feed</CardTitle>
                </CardHeader>
                <CardContent>
                  <MessageList topicId={parseInt(id)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Post Message</CardTitle>
                </CardHeader>
                <CardContent>
                  <MessageComposer topicId={parseInt(id)} onMessagePosted={loadTopic} />
                </CardContent>
              </Card>
            </div>

            {/* Right: Curated Messages */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Curated Messages</CardTitle>
                </CardHeader>
                <CardContent>
                  <CuratedMessages topicId={parseInt(id)} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
