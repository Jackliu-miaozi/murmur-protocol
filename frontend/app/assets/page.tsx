'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Coins, TrendingUp, TrendingDown } from 'lucide-react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { WalletButton } from '@/components/wallet/WalletButton'
import { useVPBalance, useStakedVdot, useStakeVdot, useWithdrawVdot } from '@/lib/hooks/useVPToken'
import { calculateVP, formatBalance } from '@/lib/utils'
import { Alert } from '@/components/ui/alert'

export default function AssetsPage() {
  const { address, isConnected } = useAccount()
  const [stakeAmount, setStakeAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  const { data: vpBalance, refetch: refetchVP } = useVPBalance(address)
  const { data: stakedVdot, refetch: refetchStaked } = useStakedVdot(address)
  const { stake, isLoading: isStaking, isSuccess: stakeSuccess } = useStakeVdot()
  const { withdraw, isLoading: isWithdrawing, isSuccess: withdrawSuccess } = useWithdrawVdot()

  useEffect(() => {
    if (stakeSuccess) {
      setStakeAmount('')
      refetchVP()
      refetchStaked()
    }
  }, [stakeSuccess, refetchVP, refetchStaked])

  useEffect(() => {
    if (withdrawSuccess) {
      setWithdrawAmount('')
      refetchStaked()
    }
  }, [withdrawSuccess, refetchStaked])

  const handleStake = () => {
    if (!stakeAmount) return
    const amount = BigInt(Math.floor(parseFloat(stakeAmount) * 1e18))
    stake(amount)
  }

  const handleWithdraw = () => {
    if (!withdrawAmount) return
    const amount = BigInt(Math.floor(parseFloat(withdrawAmount) * 1e18))
    withdraw(amount)
  }

  const calculateVPForAmount = (vdot: string): string => {
    if (!vdot) return '0'
    try {
      const amount = BigInt(Math.floor(parseFloat(vdot) * 1e18))
      const vp = calculateVP(amount)
      return formatBalance(vp)
    } catch {
      return '0'
    }
  }

  if (!isConnected) {
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
                Connect your wallet to manage your assets
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Asset Management</h1>
          <p className="text-muted-foreground mb-8">
            Manage your vDOT stakes and VP balance
          </p>

          {/* Balance Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  VP Balance
                </CardTitle>
                <CardDescription>Voice Points for participation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {vpBalance !== undefined ? formatBalance(BigInt(vpBalance.toString())) : '0'}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Available VP
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-green-500" />
                  Staked vDOT
                </CardTitle>
                <CardDescription>Staked amount</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stakedVdot !== undefined ? formatBalance(BigInt(stakedVdot.toString())) : '0'}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Currently Staked
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Stake Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Stake vDOT
              </CardTitle>
              <CardDescription>
                Stake vDOT to get VP. Formula: VP = 100 × √vDOT
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Amount (vDOT)
                  </label>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    disabled={isStaking}
                  />
                </div>
                {stakeAmount && (
                  <div className="bg-accent/50 rounded-lg p-3">
                    <p className="text-sm font-medium">You will receive:</p>
                    <p className="text-2xl font-bold">
                      {calculateVPForAmount(stakeAmount)} VP
                    </p>
                  </div>
                )}
                <Button onClick={handleStake} disabled={isStaking || !stakeAmount} className="w-full">
                  {isStaking ? 'Processing...' : 'Stake vDOT'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Withdraw Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Withdraw vDOT
              </CardTitle>
              <CardDescription>
                Withdraw your staked vDOT (VP will remain in your account)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Amount (vDOT)
                  </label>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    disabled={isWithdrawing}
                  />
                </div>
                <Button onClick={handleWithdraw} disabled={isWithdrawing || !withdrawAmount} className="w-full" variant="outline">
                  {isWithdrawing ? 'Processing...' : 'Withdraw vDOT'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info Section */}
          <Card className="mt-6 bg-accent/10">
            <CardHeader>
              <CardTitle className="text-lg">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>• Stake vDOT to receive VP (Voice Points)</p>
              <p>• VP is used to create topics, post messages, and like content</p>
              <p>• When topics are minted as NFTs, VP is refunded to participants</p>
              <p>• You can withdraw staked vDOT anytime (VP remains available)</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
