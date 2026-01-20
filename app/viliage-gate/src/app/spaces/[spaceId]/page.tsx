import { AppShell } from "@/app/_components/app-shell";
import { SpaceDetail } from "@/app/_components/space/space-detail";

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  return (
    <AppShell title="Space" subtitle="Topic timeline">
      <SpaceDetail spaceId={Number(spaceId)} />
    </AppShell>
  );
}
