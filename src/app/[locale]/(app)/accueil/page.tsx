import { getTranslations, getFormatter } from "next-intl/server";
import { ConciergeBell } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Link } from "@/lib/i18n/routing";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Tile } from "@/features/shared/ui/Tile";
import { Badge } from "@/features/shared/ui/Badge";
import { Fab } from "@/features/shared/ui/Fab";
import { HeroCard } from "@/features/accueil/ui/HeroCard";
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
  const todo = [
    { key: "restosATester", count: d.todo.restosATester },
    { key: "voyagesAVenir", count: d.todo.voyagesAVenir },
    { key: "conciergerieEnAttente", count: d.todo.conciergerieEnAttente },
  ];
  const kpis = [
    { key: "sorties", tone: "blue" as const, value: d.kpis.sorties },
    { key: "nouveauxRestos", tone: "green" as const, value: d.kpis.nouveauxRestos },
    { key: "vinsGoutes", tone: "violet" as const, value: d.kpis.vinsGoutes },
    { key: "depensesVoyage", tone: "amber" as const, value: `${Math.round(d.kpis.depensesVoyageCents / 100)} €` },
  ];
  const now = new Date();
  return (
    <main data-testid="accueil" className="flex flex-col gap-4 p-4 md:p-6">
      <HeroCard userName={userName} sorties={d.kpis.sorties} />
      <Link href="/restos" className="text-sm font-medium text-accent hover:underline">{t("addResto")}</Link>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <SectionLabel icon="✅">{t("sections.todo")}</SectionLabel>
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
          <SectionLabel icon="📊">{t("sections.month")}</SectionLabel>
          <div data-testid="kpi-tiles" className="grid grid-cols-2 gap-3">
            {kpis.map((k) => (
              <Tile key={k.key} tone={k.tone} label={t(`kpi.${k.key}`)} value={k.value} />
            ))}
          </div>
        </Card>

        <Card>
          <SectionLabel icon="✨">{t("sections.discoveries")}</SectionLabel>
          {d.discoveries.length === 0 ? (
            <p className="text-sm text-muted">{t("discoveries.vide")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.discoveries.map((x) => (
                <li key={x.title} className="text-sm">
                  <div className="text-ink">{x.title}</div>
                  <div className="text-xs text-muted">{x.source}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <SectionLabel icon="🕑">{t("sections.activity")}</SectionLabel>
        {d.activity.length === 0 ? (
          <p data-testid="recent-activity" className="text-sm text-muted">{t("activity.vide")}</p>
        ) : (
          <ul data-testid="recent-activity" className="flex flex-col gap-2">
            {d.activity.map((a, i) => (
              <li key={`${a.type}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">{a.label}</span>
                <span className="shrink-0 text-xs text-faint">{format.relativeTime(new Date(a.at), now)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Fab href="/conciergerie" label={t("fab")} icon={<ConciergeBell size={22} />} />
    </main>
  );
}
