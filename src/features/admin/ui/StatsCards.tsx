import { getTranslations } from "next-intl/server";
import { Tile } from "@/features/shared/ui/Tile";
import type { Tone } from "@/features/shared/ui/helpers";

type Stats = { totalUsers: number; premiumActifs: number; demandesParStatut: Record<string, number> };

export async function StatsCards({ stats }: { stats: Stats }) {
  const t = await getTranslations("admin");
  const totalDemandes = Object.values(stats.demandesParStatut).reduce((a, b) => a + b, 0);
  const cards: { label: string; value: number; tone: Tone }[] = [
    { label: t("kpiUsers"), value: stats.totalUsers, tone: "blue" },
    { label: t("kpiPremium"), value: stats.premiumActifs, tone: "green" },
    { label: t("kpiDemandes"), value: totalDemandes, tone: "amber" },
  ];
  return (
    <section data-testid="admin-stats" className="flex gap-4 flex-wrap">
      {cards.map((c) => (
        <Tile key={c.label} tone={c.tone} label={c.label} value={c.value} />
      ))}
    </section>
  );
}
