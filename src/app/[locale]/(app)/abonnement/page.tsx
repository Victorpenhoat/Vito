import { getTranslations } from "next-intl/server";
import { getSubscription, getIsPremium } from "@/features/abonnement/data/queries";
import { SubscribeButtons } from "@/features/abonnement/ui/SubscribeButtons";
import { CancelButton } from "@/features/abonnement/ui/CancelButton";
import { PageHeader } from "@/features/shared/ui/PageHeader";

function FeatureRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 py-1.5 text-sm">
      <span className={ok ? "text-accent" : "text-faint"}>{ok ? "✓" : "—"}</span>
      <span className={ok ? "text-ink" : "text-faint"}>{label}</span>
    </li>
  );
}

export default async function AbonnementPage() {
  const t = await getTranslations("abonnement");
  const sub = await getSubscription();
  const isPremium = await getIsPremium();
  const canceled = sub?.status === "canceled";
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("fr-FR") : "";
  const feats = [
    { key: "carnet", free: true },
    { key: "voyages", free: true },
    { key: "conciergerie", free: false },
    { key: "foyer", free: false },
  ] as const;
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <div className="grid max-w-3xl gap-5 md:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{t("gratuit")}</div>
          <div className="mt-2 font-serif text-3xl font-medium text-ink">{t("gratuitPrix")}</div>
          <div className="text-sm text-muted">{t("gratuitSous")}</div>
          <ul className="mt-4 border-t border-line-soft pt-2">
            {feats.map((f) => <FeatureRow key={f.key} ok={f.free} label={t(`feat.${f.key}`)} />)}
          </ul>
        </div>
        <div data-testid="plan-actuel" className="relative rounded-card border-[1.5px] border-accent bg-surface p-7">
          {isPremium && (
            <span data-testid="premium-badge" className="absolute right-5 top-5 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">{t("premium")}</span>
          )}
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{t("premium")}</div>
          <div className="mt-2 font-serif text-3xl font-medium text-ink">{t("prixMois")}</div>
          <div className="text-sm text-muted">{t("prixAn")}</div>
          <ul className="mt-4 border-t border-line-soft pt-2">
            {feats.map((f) => <FeatureRow key={f.key} ok={true} label={t(`feat.${f.key}`)} />)}
          </ul>
          <div className="mt-5 flex flex-col gap-2">
            {!isPremium && <SubscribeButtons />}
            {isPremium && !canceled && <CancelButton />}
            {isPremium && (
              <p className="text-sm text-muted">{canceled ? t("premiumUntil", { date: periodEnd }) : t("renewsOn", { date: periodEnd })}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
