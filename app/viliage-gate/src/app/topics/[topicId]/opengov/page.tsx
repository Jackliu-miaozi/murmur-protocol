import { AppShell } from "@/app/_components/app-shell";
import { OpenGovPanel } from "@/app/_components/opengov/opengov-panel";

export default function OpenGovPage({
  params,
}: {
  params: { topicId: string };
}) {
  return (
    <AppShell title="OpenGov" subtitle="Proposal status">
      <OpenGovPanel topicId={Number(params.topicId)} />
    </AppShell>
  );
}
