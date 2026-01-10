'use client'

import React from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Wallet } from 'lucide-react'
import { formatAddress } from '@/lib/utils'

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [open, setOpen] = React.useState(false)

  const handleConnect = (connector: any) => {
    connect({ connector })
    setOpen(false)
  }

  if (isConnected && address) {
    return (
      <Button variant="outline" onClick={() => disconnect()}>
        <Wallet className="mr-2 h-4 w-4" />
        {formatAddress(address)}
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>
            Choose a wallet to connect to Murmur Protocol
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => handleConnect(connector)}
              disabled={!connector.ready}
              className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🦊</span>
                <span className="font-medium">{connector.name}</span>
              </div>
              {!connector.ready && (
                <span className="text-sm text-muted-foreground">
                  Not Installed
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center mt-4">
          Don't have a wallet?{' '}
          <a
            href="https://metamask.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Install MetaMask
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
