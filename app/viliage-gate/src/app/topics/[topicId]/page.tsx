import { AppShell } from "@/app/_components/app-shell";
import { TopicArena } from "@/app/_components/topic/topic-arena";

export default function TopicPage({
  params,
}: {
  params: { topicId: string };
}) {
  return (
    <AppShell title="Live Arena" subtitle="Signal in motion">
      <TopicArena topicId={Number(params.topicId)} />
    </AppShell>
  );
}
