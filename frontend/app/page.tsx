import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet/WalletButton";
import { TopicList } from "@/components/topic/TopicList";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            <span className="text-xl font-bold">Murmur Protocol</span>
          </Link>
          
          <nav className="flex items-center gap-4">
            <Link href="/topics">
              <Button variant="ghost">Topics</Button>
            </Link>
            <Link href="/assets">
              <Button variant="ghost">Assets</Button>
            </Link>
            <Link href="/gallery">
              <Button variant="ghost">NFT Gallery</Button>
            </Link>
            <WalletButton />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-4">
              Real-time Discussions on Polkadot
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Stake vDOT, earn VP, and participate in curated conversations
            </p>
            <Link href="/topics/create">
              <Button size="lg">Create New Topic</Button>
            </Link>
          </div>

          <TopicList />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Murmur Protocol - Decentralized Discussion Platform</p>
        </div>
      </footer>
    </div>
  );
}
