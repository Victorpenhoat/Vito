import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { ListeActivites } from "@/features/activites/ui/ListeActivites";
import { SousOnglets, ongletValide } from "@/features/activites/ui/SousOnglets";
import { VueSemaine } from "@/features/activites/ui/VueSemaine";
import { VueCarte } from "@/features/activites/ui/VueCarte";

// Onglet Activités (design docs/design/Onglet_Activites.dc.html).
export default async function ActivitesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("activites");
  const params = await searchParams;
  const actif = ongletValide(typeof params.onglet === "string" ? params.onglet : undefined);

  // L'heure du serveur, une seule fois : le domaine ne lit pas l'horloge, et
  // deux appels dans le même rendu peuvent tomber de part et d'autre de minuit.
  const maintenant = new Date();
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const heure = maintenant.toISOString().slice(11, 16);

  return (
    <main className="flex flex-col gap-4 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1100px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("titre")} />

      {actif === "en_cours" || actif === "tous" ? (
        <ListeActivites params={params} actif={actif} aujourdhui={aujourdhui} heure={heure} />
      ) : (
        <>
          <SousOnglets actif={actif} />
          {actif === "semaine" && (
            <VueSemaine
              semaine={typeof params.semaine === "string" ? params.semaine : aujourdhui}
              aujourdhui={aujourdhui}
            />
          )}
          {actif === "carte" && <VueCarte params={params} aujourdhui={aujourdhui} />}
        </>
      )}
    </main>
  );
}
