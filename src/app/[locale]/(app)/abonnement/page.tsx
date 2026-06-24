import { getTranslations } from "next-intl/server";
import { getSubscription, getIsPremium } from "@/features/abonnement/data/queries";
import { SubscribeButtons } from "@/features/abonnement/ui/SubscribeButtons";
import { CancelButton } from "@/features/abonnement/ui/CancelButton";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function AbonnementPage() {
  const t = await getTranslations("abonnement");
  const sub = await getSubscription();
  const isPremium = await getIsPremium();
  const canceled = sub?.status === "canceled";
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("fr-FR") : "";
  return (
    <main className="p-4 md:p-6 flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <section data-testid="plan-actuel" className="rounded-card border border-line bg-surface p-4">
        {isPremium ? (
          <p>
            <span data-testid="premium-badge" className="font-semibold text-green-700">{t("premium")}</span>{" "}
            {canceled ? t("premiumUntil", { date: periodEnd }) : t("renewsOn", { date: periodEnd })}
          </p>
        ) : (
          <p>{t("free")}</p>
        )}
      </section>
      {!isPremium && <SubscribeButtons />}
      {isPremium && !canceled && <CancelButton />}
    </main>
  );
}
