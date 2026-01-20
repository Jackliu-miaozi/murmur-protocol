import { AppShell } from "@/app/_components/app-shell";
import { AdminDashboard } from "@/app/_components/admin/admin-dashboard";

export default function AdminPage() {
  return (
    <AppShell title="Admin" subtitle="Settlement & operations">
      <AdminDashboard />
    </AppShell>
  );
}
