import { AppShell } from "@/app/_components/app-shell";
import { SpaceDetail } from "@/app/_components/space/space-detail";

export default function SpaceDetailPage({
  params,
}: {
  params: { spaceId: string };
}) {
  return (
    <AppShell title="Space" subtitle="Topic timeline">
      <SpaceDetail spaceId={Number(params.spaceId)} />
    </AppShell>
  );
}
