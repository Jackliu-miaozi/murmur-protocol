import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet/WalletButton";
import { TopicList } from "@/components/topic/TopicList";

export default function TopicsPage() {
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">All Topics</h1>
              <p className="text-muted-foreground">
                Browse and join active discussions
              </p>
            </div>
            <Link href="/topics/create">
              <Button>Create New Topic</Button>
            </Link>
          </div>

          <TopicList />
        </div>
      </main>
    </div>
  );
}
