import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/rbac/guards";
import { getAdminUsers, getAdminSubscriptions, getAdminDemandes } from "@/features/admin/data/queries";
import { computeAdminStats } from "@/features/admin/domain/stats";
import { StatsCards } from "@/features/admin/ui/StatsCards";
import { UsersTable } from "@/features/admin/ui/UsersTable";
import { SubscriptionsTable } from "@/features/admin/ui/SubscriptionsTable";
import { DemandesTable } from "@/features/admin/ui/DemandesTable";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function AdminPage() {
  await requireRole(["admin"]); // redirige les non-admin
  const t = await getTranslations("admin");
  const [users, subscriptions, demandes] = await Promise.all([
    getAdminUsers(),
    getAdminSubscriptions(),
    getAdminDemandes(),
  ]);
  const stats = computeAdminStats(
    {
      users,
      subscriptions: subscriptions.map((s) => ({ status: s.status, currentPeriodEnd: s.current_period_end })),
      demandes,
    },
    new Date(),
  );
  return (
    <main className="p-6 flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <StatsCards stats={stats} />
      <UsersTable users={users} />
      <SubscriptionsTable subscriptions={subscriptions} />
      <DemandesTable demandes={demandes} />
    </main>
  );
}
