import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { VoyageForm } from "@/features/voyages/ui/VoyageForm";
import { VoyagesList } from "@/features/voyages/ui/VoyagesList";
import { getMesVoyages } from "@/features/voyages/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

// Onglet Voyages (design Onglet_Voyages, écran 1) : sous-onglets par statut,
// cards à couverture. Le bouton Planning (écran 2) arrive au lot E.
export default async function VoyagesPage() {
  const t = await getTranslations("voyages");
  const voyages = await getMesVoyages();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("heading")}
        action={
          <a
            href="#nouveau"
            aria-label={t("create")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_6px_16px_rgba(37,99,235,.35)] transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Plus size={18} aria-hidden />
          </a>
        }
      />
      {voyages.length === 0 ? (
        <p className="text-sm text-muted">{t("vide")}</p>
      ) : (
        <VoyagesList voyages={voyages} today={today} />
      )}
      <section id="nouveau" className="mt-4 flex scroll-mt-4 flex-col gap-3 border-t border-line pt-6">
        <SectionLabel>{t("nouveauVoyage")}</SectionLabel>
        <VoyageForm />
      </section>
    </main>
  );
}
