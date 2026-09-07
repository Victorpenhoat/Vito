import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { getActivites } from "@/features/activites/data/queries";
import { SousOnglets, ongletValide } from "@/features/activites/ui/SousOnglets";
import { EtatVide } from "@/features/activites/ui/EtatVide";

// Onglet Activités (design docs/design/Onglet_Activites.dc.html).
//
// Incrément 2 : la route, les sous-onglets et la couche de données. Les listes,
// la semaine et la carte arrivent aux incréments suivants — l'écran montre
// aujourd'hui ce qu'il sait montrer, c'est-à-dire ses états vides.
export default async function ActivitesPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const t = await getTranslations("activites");
  const { onglet } = await searchParams;
  const actif = ongletValide(onglet);

  // L'heure du serveur, une seule fois : le domaine ne lit pas l'horloge, et
  // deux appels à `new Date()` dans le même rendu peuvent tomber de part et
  // d'autre de minuit.
  const maintenant = new Date();
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const heure = maintenant.toISOString().slice(11, 16);

  const activites = await getActivites(aujourdhui, heure);
  const enCours = activites.filter((a) => a.statut === "en_cours");

  return (
    <main className="flex flex-col gap-4 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1100px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("titre")} />
      <SousOnglets actif={actif} />

      {actif === "en_cours" && enCours.length === 0 && (
        <EtatVide titre={t("vide.aucuneTitre")} explication={t("vide.aucuneTexte")} />
      )}
      {actif === "tous" && activites.length === 0 && (
        <EtatVide titre={t("vide.aucuneTitre")} explication={t("vide.aucuneTexte")} />
      )}
      {actif === "semaine" && (
        <EtatVide titre={t("vide.semaineTitre")} explication={t("vide.semaineTexte")} />
      )}
      {actif === "carte" && (
        <EtatVide titre={t("vide.carteTitre")} explication={t("vide.carteTexte")} />
      )}
    </main>
  );
}
