import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { getReception, getPlaceIdsDuCarnet } from "@/features/reception/data/queries";
import { ReceptionList } from "@/features/reception/ui/ReceptionList";

// Boîte de réception (lot 2) : les adresses qu'un proche m'a recommandées.
// Écran global toutes catégories — Restos et Hôtels y arrivent ensemble, les
// vins suivront.
export default async function ReceptionPage() {
  const t = await getTranslations("reception");
  const [boite, placeIds] = await Promise.all([getReception(), getPlaceIdsDuCarnet()]);
  return (
    <main className="flex flex-col gap-5 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[900px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("titre")} />
      <ReceptionList boite={boite} placeIdsDuCarnet={placeIds} />
    </main>
  );
}
