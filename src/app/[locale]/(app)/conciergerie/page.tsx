import { getTranslations } from "next-intl/server";
import { getSessionRole } from "@/lib/rbac/guards";
import { getMesDemandes, getInboxConciergerie } from "@/features/conciergerie/data/queries";
import { getIsPremium } from "@/features/abonnement/data/queries";
import { DemandesList } from "@/features/conciergerie/ui/DemandesList";
import { DemandeHotelForm } from "@/features/conciergerie/ui/DemandeHotelForm";
import { ConciergeInbox } from "@/features/conciergerie/ui/ConciergeInbox";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Card } from "@/features/shared/ui/Card";

export default async function ConciergeriePage() {
  const t = await getTranslations("conciergerie");
  const role = await getSessionRole();
  const isStaff = role === "agence" || role === "admin";
  if (isStaff) {
    const demandes = await getInboxConciergerie();
    return (
      <main className="flex flex-col gap-6 p-4 md:p-8">
        <PageHeader eyebrow={t("eyebrow")} title={t("inbox")} />
        <ConciergeInbox demandes={demandes} />
      </main>
    );
  }
  const [demandes, isPremium] = await Promise.all([getMesDemandes(), getIsPremium()]);
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        action={isPremium ? <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-surface">{t("premiumActif")}</span> : undefined}
      />
      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-3">
          <SectionLabel>{t("mesDemandes")}</SectionLabel>
          <DemandesList demandes={demandes} />
        </section>
        <aside>
          <Card>
            <SectionLabel>{t("types.hotel")}</SectionLabel>
            <DemandeHotelForm />
          </Card>
        </aside>
      </div>
    </main>
  );
}
