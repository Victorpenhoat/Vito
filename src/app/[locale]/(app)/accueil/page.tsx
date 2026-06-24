import { getTranslations } from "next-intl/server";
import { ConciergeBell } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Link } from "@/lib/i18n/routing";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Tile } from "@/features/shared/ui/Tile";
import { Badge } from "@/features/shared/ui/Badge";
import { Fab } from "@/features/shared/ui/Fab";
import { HeroCard } from "@/features/accueil/ui/HeroCard";
import { MONTHLY_KPIS, TODO, DISCOVERIES, ACTIVITY } from "@/features/accueil/mock";

export default async function AccueilPage() {
  const t = await getTranslations("accueil");
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  let userName = auth.user?.email ?? "";
  if (auth.user) {
    const { data: profile } = await supabase
      .from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
    if (profile?.display_name) userName = profile.display_name;
  }
  return (
    <main data-testid="accueil" className="flex flex-col gap-4 p-4 md:p-6">
      <HeroCard userName={userName} />
      <Link href="/restos" className="text-sm font-medium text-accent hover:underline">{t("addResto")}</Link>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <SectionLabel icon="✅">{t("sections.todo")}</SectionLabel>
          <ul className="flex flex-col gap-2">
            {TODO.map((it) => (
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
            {MONTHLY_KPIS.map((k) => (
              <Tile key={k.key} tone={k.tone} label={t(`kpi.${k.key}`)} value={k.value} />
            ))}
          </div>
        </Card>

        <Card>
          <SectionLabel icon="✨">{t("sections.discoveries")}</SectionLabel>
          <ul className="flex flex-col gap-2">
            {DISCOVERIES.map((d) => (
              <li key={d.title} className="text-sm">
                <div className="text-ink">{d.title}</div>
                <div className="text-xs text-muted">{d.source}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <SectionLabel icon="🕑">{t("sections.activity")}</SectionLabel>
        <ul data-testid="recent-activity" className="flex flex-col gap-2">
          {ACTIVITY.map((a) => (
            <li key={a.title} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink">{a.title}</span>
              <span className="shrink-0 text-xs text-faint">{a.ago}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Fab href="/conciergerie" label={t("fab")} icon={<ConciergeBell size={22} />} />
    </main>
  );
}
