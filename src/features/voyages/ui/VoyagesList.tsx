import { getMesVoyages } from "../data/queries";
import { splitVoyages } from "../domain/splitVoyages";
import { VoyageCard } from "./VoyageCard";
import { VoyageFeatured } from "./VoyageFeatured";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { getTranslations, getLocale } from "next-intl/server";

export async function VoyagesList() {
  const t = await getTranslations("voyages");
  const locale = await getLocale();
  const voyages = await getMesVoyages();
  if (voyages.length === 0) return <p className="text-sm text-muted">{t("vide")}</p>;
  const today = new Date().toISOString().slice(0, 10);
  const { prochain, reste } = splitVoyages(voyages, today);
  return (
    <div className="flex flex-col gap-8">
      {prochain && (
        <section>
          <SectionLabel>{t("prochainDepart")}</SectionLabel>
          <VoyageFeatured voyage={prochain} />
        </section>
      )}
      {reste.length > 0 && (
        <section>
          <SectionLabel>{t("carnetRoute")}</SectionLabel>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reste.map((v) => <VoyageCard key={v.id} voyage={v} statutLabel={t(`statuts.${v.statut}`)} locale={locale} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
