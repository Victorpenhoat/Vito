import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { getActivites } from "@/features/activites/data/queries";
import { SousOnglets, ongletValide } from "@/features/activites/ui/SousOnglets";
import { EtatVide } from "@/features/activites/ui/EtatVide";
import { LigneActivite } from "@/features/activites/ui/LigneActivite";
import { FiltresActivites } from "@/features/activites/ui/FiltresActivites";
import { RechercheActivites } from "@/features/activites/ui/RechercheActivites";
import { filtrerActivites, grouperParMembre } from "@/features/activites/domain/liste";
import { STATUTS_ACTIVITE } from "@/features/activites/domain/activite";

// Onglet Activités (design docs/design/Onglet_Activites.dc.html).
//
// Les vues « En cours » et « Tous » partagent la même liste : la première la
// restreint aux activités en cours et la groupe par membre, la seconde ouvre
// les filtres. Deux écrans, une seule mécanique.

/** Un paramètre d'URL peut arriver seul ou répété : on lit toujours une liste. */
function liste(valeur: string | string[] | undefined): string[] {
  return valeur === undefined ? [] : Array.isArray(valeur) ? valeur : [valeur];
}

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

  const toutes = await getActivites(aujourdhui, heure);
  const recherche = typeof params.q === "string" ? params.q : undefined;

  const filtrees = filtrerActivites(toutes, {
    membres: liste(params.membre),
    statuts: actif === "en_cours" ? ["en_cours"] : liste(params.statut),
    types: liste(params.type),
    tags: liste(params.tag),
    recherche,
  });
  const groupes = grouperParMembre(filtrees);

  // Les options des filtres viennent de ce que le carnet contient : proposer un
  // type qu'aucune activité ne porte donnerait un filtre qui ne filtre rien.
  const membresConnus = [...new Map(toutes.flatMap((a) => a.membres).map((m) => [m.id, m])).values()];
  const typesConnus = [...new Set(toutes.map((a) => a.type))];
  const tagsConnus = [...new Map(toutes.flatMap((a) => a.tags).map((t) => [t.slug, t])).values()];

  return (
    <main className="flex flex-col gap-4 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1100px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("titre")} />
      <SousOnglets actif={actif} />

      {(actif === "en_cours" || actif === "tous") && toutes.length > 0 && <RechercheActivites />}

      {actif === "tous" && toutes.length > 0 && (
        <FiltresActivites
          dimensions={[
            { cle: "membre", libelle: t("filtres.membre"),
              options: membresConnus.map((m) => ({ valeur: m.id, libelle: m.prenom, couleur: m.couleur })) },
            { cle: "statut", libelle: t("filtres.statut"),
              options: STATUTS_ACTIVITE.map((s) => ({ valeur: s, libelle: t(`statuts.${s}`) })) },
            { cle: "type", libelle: t("filtres.type"),
              options: typesConnus.map((ty) => ({ valeur: ty, libelle: t(`types.${ty}`) })) },
            ...(tagsConnus.length
              ? [{ cle: "tag", libelle: t("filtres.tag"),
                   options: tagsConnus.map((tag) => ({ valeur: tag.slug, libelle: tag.label })) }]
              : []),
          ]}
        />
      )}

      {(actif === "en_cours" || actif === "tous") && (
        filtrees.length === 0 ? (
          toutes.length === 0
            ? <EtatVide titre={t("vide.aucuneTitre")} explication={t("vide.aucuneTexte")} />
            : <EtatVide titre={t("vide.filtreTitre")} explication={t("vide.filtreTexte")} />
        ) : (
          <>
            <p data-testid="activites-compte" className="text-[11.5px] text-muted">
              {t("compte", { n: filtrees.length })}
            </p>
            <div className="flex flex-col gap-4">
              {groupes.map((g) => (
                <section key={g.membre?.id ?? "sans-membre"} data-testid="activites-groupe"
                  className="rounded-card border border-line bg-surface px-3.5 py-1">
                  <header className="flex items-center gap-2 border-b border-line-soft py-2.5">
                    <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold text-white"
                      style={{ background: g.membre?.couleur ?? "var(--line)" }}>
                      {g.membre ? g.membre.prenom.slice(0, 1).toUpperCase() : "—"}
                    </span>
                    <span className="text-[13px] font-medium text-ink">
                      {g.membre?.prenom ?? t("sansMembre")}
                    </span>
                    <span className="text-[11.5px] text-muted">{t("compte", { n: g.activites.length })}</span>
                  </header>
                  <ul className="flex flex-col">
                    {g.activites.map((a) => (
                      <LigneActivite key={a.id} activite={a} aujourdhui={aujourdhui}
                        montrerStatut={actif === "tous"} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )
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
