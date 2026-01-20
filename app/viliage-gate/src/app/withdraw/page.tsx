import { AppShell } from "@/app/_components/app-shell";
import { WithdrawPanel } from "@/app/_components/withdraw/withdraw-panel";

export default function WithdrawPage() {
  return (
    <AppShell title="Withdraw" subtitle="Exit VP back to vDOT">
      <WithdrawPanel />
    </AppShell>
  );
}
