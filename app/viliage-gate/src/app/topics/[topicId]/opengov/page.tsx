import { AppShell } from "@/app/_components/app-shell";
import { OpenGovPanel } from "@/app/_components/opengov/opengov-panel";

export default async function OpenGovPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  return (
    <AppShell title="OpenGov" subtitle="Proposal status">
      <OpenGovPanel topicId={Number(topicId)} />
    </AppShell>
  );
}
