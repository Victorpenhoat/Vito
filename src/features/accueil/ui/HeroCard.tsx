import { getTranslations, getFormatter } from "next-intl/server";
import { Star } from "lucide-react";
import { greeting } from "../greeting";
import { SORTIES_THIS_MONTH } from "../mock";

export async function HeroCard({ userName }: { userName: string }) {
  const t = await getTranslations("accueil");
  const format = await getFormatter();
  const hour = new Date().getHours();
  const mode = greeting(hour);
  const firstName = userName.split(/[\s@]/)[0] || userName;
  const emoji = mode === "bonsoir" ? "🌙" : "☀️";
  return (
    <section
      data-testid="hero"
      className="rounded-card bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))] p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {t(`greeting.${mode}`)} {firstName} {emoji}
          </h1>
          <p className="mt-1 text-sm capitalize text-muted">
            {format.dateTime(new Date(), { dateStyle: "full" })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-xs text-muted">
          {t("sortiesMois", { n: SORTIES_THIS_MONTH })}
          <Star size={14} className="text-kpi-amber" />
        </div>
      </div>
      <p className="mt-4 border-l-4 border-accent pl-3 text-ink">{t("quote")}</p>
    </section>
  );
}
