import { getTranslations, getFormatter } from "next-intl/server";
import { ConciergeBell } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Link } from "@/lib/i18n/routing";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Badge } from "@/features/shared/ui/Badge";
import { Fab } from "@/features/shared/ui/Fab";
import { HeroCard } from "@/features/accueil/ui/HeroCard";
import { StatsRow } from "@/features/accueil/ui/StatsRow";
import { getDashboardData } from "@/features/accueil/data/queries";

export default async function AccueilPage() {
  const t = await getTranslations("accueil");
  const format = await getFormatter();
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  let userName = auth.user?.email ?? "";
  if (auth.user) {
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
    if (profile?.display_name) userName = profile.display_name;
  }
  const d = await getDashboardData();
  const now = new Date();
  const stats = [
    { label: t("kpi.sorties"), value: d.kpis.sorties },
    { label: t("kpi.nouveauxRestos"), value: d.kpis.nouveauxRestos },
    { label: t("kpi.vinsGoutes"), value: d.kpis.vinsGoutes },
    { label: t("kpi.depensesVoyage"), value: `${Math.round(d.kpis.depensesVoyageCents / 100)} €` },
  ];
  const todo = [
    { key: "restosATester", count: d.todo.restosATester },
    { key: "voyagesAVenir", count: d.todo.voyagesAVenir },
    { key: "conciergerieEnAttente", count: d.todo.conciergerieEnAttente },
  ];
  return (
    <main data-testid="accueil" className="flex flex-col gap-6 p-4 pb-20 md:p-8 md:pb-8">
      <HeroCard userName={userName} />
      {/* Les 4 tuiles sont bornées au mois calendaire (monthRange) : sans libellé de période,
          un « 0 » à côté d'une activité récente semble cassé (audit du 03/07). */}
      <SectionLabel>{t("sections.month")}</SectionLabel>
      <StatsRow stats={stats} />
      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
        <section>
          <SectionLabel>{t("sections.activity")}</SectionLabel>
          {d.activity.length === 0 ? (
            <p data-testid="recent-activity" className="text-sm text-muted">{t("activity.vide")}</p>
          ) : (
            <ul data-testid="recent-activity" className="flex flex-col">
              {d.activity.map((a, i) => (
                <li key={`${a.type}-${i}`} className="flex items-center justify-between gap-3 border-b border-line-soft py-3 text-sm">
                  <span className="text-ink">{a.label}</span>
                  <span className="shrink-0 text-xs text-faint">{format.relativeTime(new Date(a.at), now)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="flex flex-col gap-6">
          <Card>
            <SectionLabel>{t("sections.todo")}</SectionLabel>
            <ul className="flex flex-col gap-2">
              {todo.map((it) => (
                <li key={it.key} className="flex items-center justify-between text-sm text-ink">
                  <span>{t(`todo.${it.key}`)}</span>
                  <Badge>{it.count}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <SectionLabel>{t("sections.discoveries")}</SectionLabel>
            {d.discoveries.length === 0 ? (
              <p className="text-sm text-muted">{t("discoveries.vide")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {d.discoveries.map((x) => (
                  <li key={x.title}>
                    <div className="font-serif text-ink">{x.title}</div>
                    <div className="text-xs text-muted">
                      {t("discoveries.suggested")}{x.source ? ` · ${x.source}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
      <Link href="/restos" className="text-sm font-medium text-accent hover:underline">{t("addResto")}</Link>
      <Fab href="/conciergerie" label={t("fab")} icon={<ConciergeBell size={22} />} />
    </main>
  );
}
