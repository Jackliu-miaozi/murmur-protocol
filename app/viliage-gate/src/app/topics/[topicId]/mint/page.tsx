import { AppShell } from "@/app/_components/app-shell";
import { MintPanel } from "@/app/_components/mint/mint-panel";

export default async function MintPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  return (
    <AppShell title="Mint" subtitle="Preserve the memory">
      <MintPanel topicId={Number(topicId)} />
    </AppShell>
  );
}
