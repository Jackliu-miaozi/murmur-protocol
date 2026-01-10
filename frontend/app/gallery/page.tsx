'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Award, Calendar, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WalletButton } from '@/components/wallet/WalletButton'
import { nftMinterContract } from '@/lib/contracts/nftMinter'
import { topicFactoryContract } from '@/lib/contracts'
import { getFromIPFS } from '@/lib/ipfs'
import { useWalletStore } from '@/lib/stores/walletStore'
import { formatAddress } from '@/lib/utils'
import type { NFTMetadata, TopicMetadata } from '@/types'

export default function GalleryPage() {
  const { selectedAccount } = useWalletStore()
  const [nfts, setNfts] = useState<Array<{ metadata: NFTMetadata; topicMetadata?: TopicMetadata }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (selectedAccount) {
      loadNFTs()
    }
  }, [selectedAccount])

  const loadNFTs = async () => {
    if (!selectedAccount) return

    try {
      setLoading(true)
      // In production, this should query all NFTs
      // For now, we'll try to load NFTs for token IDs 1-10
      const nftList: Array<{ metadata: NFTMetadata; topicMetadata?: TopicMetadata }> = []

      for (let tokenId = 1; tokenId <= 10; tokenId++) {
        try {
          const metadata = await nftMinterContract.getMetadata(tokenId, selectedAccount.address)
          if (metadata) {
            // Try to load topic metadata from IPFS
            try {
              const topic = await topicFactoryContract.getTopic(metadata.topicId, selectedAccount.address)
              if (topic) {
                const topicMetadata = await getFromIPFS<TopicMetadata>(topic.metadataHash)
                nftList.push({ metadata, topicMetadata })
              } else {
                nftList.push({ metadata })
              }
            } catch (error) {
              nftList.push({ metadata })
            }
          }
        } catch (error) {
          // Token doesn't exist, continue
        }
      }

      setNfts(nftList)
    } catch (error) {
      console.error('Failed to load NFTs:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!selectedAccount) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Home</span>
            </Link>
            <WalletButton />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Connect Wallet</CardTitle>
              <CardDescription>
                Connect your wallet to view NFTs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WalletButton />
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
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Home</span>
          </Link>
          <WalletButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">NFT Gallery</h1>
          <p className="text-muted-foreground mb-8">
            Browse minted topic NFTs - permanent records of curated discussions
          </p>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading NFTs...</p>
            </div>
          ) : nfts.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No NFTs Found</CardTitle>
                <CardDescription>
                  NFTs will appear here once topics are minted
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/topics">
                  <Button>Browse Topics</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {nfts.map(({ metadata, topicMetadata }) => (
                <Card key={metadata.tokenId} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Award className="h-8 w-8 text-primary" />
                      <span className="text-sm font-mono text-muted-foreground">
                        #{metadata.tokenId}
                      </span>
                    </div>
                    <CardTitle className="line-clamp-2">
                      {topicMetadata?.title || `Topic #${metadata.topicId}`}
                    </CardTitle>
                    {topicMetadata?.description && (
                      <CardDescription className="line-clamp-2">
                        {topicMetadata.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Topic ID</span>
                        <Link href={`/topics/${metadata.topicId}`}>
                          <Button variant="link" size="sm" className="h-auto p-0">
                            #{metadata.topicId}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Minted By</span>
                        <span className="font-mono text-xs">
                          {formatAddress(metadata.mintedBy, 3)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {new Date(metadata.mintedAt * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
