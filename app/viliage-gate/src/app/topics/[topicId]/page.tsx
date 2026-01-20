import { AppShell } from "@/app/_components/app-shell";
import { TopicArena } from "@/app/_components/topic/topic-arena";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  return (
    <AppShell title="Live Arena" subtitle="Signal in motion">
      <TopicArena topicId={Number(topicId)} />
    </AppShell>
  );
}
