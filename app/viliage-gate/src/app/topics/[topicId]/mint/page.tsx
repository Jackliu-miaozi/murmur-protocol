import { AppShell } from "@/app/_components/app-shell";
import { MintPanel } from "@/app/_components/mint/mint-panel";

export default function MintPage({
  params,
}: {
  params: { topicId: string };
}) {
  return (
    <AppShell title="Mint" subtitle="Preserve the memory">
      <MintPanel topicId={Number(params.topicId)} />
    </AppShell>
  );
}
