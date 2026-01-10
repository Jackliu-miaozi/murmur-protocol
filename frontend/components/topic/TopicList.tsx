'use client'

import React from 'react'
import { useAccount } from 'wagmi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WalletButton } from '@/components/wallet/WalletButton'
import Link from 'next/link'

export function TopicList() {
  const { isConnected } = useAccount()

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Active Topics</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {isConnected ? 'Loading topics...' : 'Connect Wallet'}
            </CardTitle>
            <CardDescription>
              {isConnected 
                ? 'Topics will appear here once loaded from the contract'
                : 'Connect your wallet to view and create topics'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <WalletButton />
            ) : (
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">No topics found. Be the first to create one!</p>
                <Link href="/topics/create">
                  <Button>Create Topic</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
