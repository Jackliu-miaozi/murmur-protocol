import { AppShell } from "@/app/_components/app-shell";
import { WalletPanel } from "@/app/_components/wallet/wallet-panel";
import { VpHistory } from "@/app/_components/wallet/vp-history";

export default function WalletPage() {
  return (
    <AppShell title="VP Energy" subtitle="Balance and respiration">
      <div className="grid gap-8">
        <WalletPanel />
        <VpHistory />
      </div>
    </AppShell>
  );
}
