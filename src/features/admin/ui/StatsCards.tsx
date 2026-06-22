import { getTranslations } from "next-intl/server";

type Stats = { totalUsers: number; premiumActifs: number; demandesParStatut: Record<string, number> };

export async function StatsCards({ stats }: { stats: Stats }) {
  const t = await getTranslations("admin");
  const totalDemandes = Object.values(stats.demandesParStatut).reduce((a, b) => a + b, 0);
  const cards = [
    { label: t("kpiUsers"), value: stats.totalUsers },
    { label: t("kpiPremium"), value: stats.premiumActifs },
    { label: t("kpiDemandes"), value: totalDemandes },
  ];
  return (
    <section data-testid="admin-stats" className="flex gap-4 flex-wrap">
      {cards.map((c) => (
        <div key={c.label} className="border p-4 min-w-32">
          <div className="text-sm text-gray-600">{c.label}</div>
          <div className="text-2xl font-bold">{c.value}</div>
        </div>
      ))}
    </section>
  );
}
