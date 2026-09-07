import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { getActivites } from "../data/queries";
import { getProches } from "@/features/famille/data/queries";
import { SousOnglets, type OngletActivites } from "./SousOnglets";
import { EtatVide } from "./EtatVide";
import { LigneActivite } from "./LigneActivite";
import { FiltresActivites } from "./FiltresActivites";
import { RechercheActivites } from "./RechercheActivites";
import { FormulaireActivite } from "./FormulaireActivite";
import { filtrerActivites, grouperParMembre } from "../domain/liste";
import { STATUTS_ACTIVITE } from "../domain/activite";

/** Un paramètre d'URL peut arriver seul ou répété : on lit toujours une liste. */
function liste(valeur: string | string[] | undefined): string[] {
  return valeur === undefined ? [] : Array.isArray(valeur) ? valeur : [valeur];
}

/**
 * Les vues « En cours » et « Tous », et — sur grand écran — la fiche À CÔTÉ.
 *
 * Même composition que le carnet des restos : la route de détail rend la liste
 * ET la fiche, la liste s'effaçant sur téléphone. On passe ainsi d'une activité
 * à l'autre sans aller-retour, et il n'y a qu'un seul rendu de liste.
 */
export async function ListeActivites({ params, actif, aujourdhui, heure, detail, selectedId }: {
  params: Record<string, string | string[] | undefined>;
  actif: OngletActivites;
  aujourdhui: string;
  heure: string;
  detail?: ReactNode;
  selectedId?: string;
}) {
  const t = await getTranslations("activites");
  const [toutes, proches] = await Promise.all([getActivites(aujourdhui, heure), getProches()]);
  const recherche = typeof params.q === "string" ? params.q : undefined;

  const filtrees = filtrerActivites(toutes, {
    membres: liste(params.membre),
    statuts: actif === "en_cours" ? ["en_cours"] : liste(params.statut),
    types: liste(params.type),
    tags: liste(params.tag),
    recherche,
  });
  const groupes = grouperParMembre(filtrees);

  // Les options viennent de ce que le carnet contient : proposer un type
  // qu'aucune activité ne porte donnerait un filtre qui ne filtre rien.
  const membresConnus = [...new Map(toutes.flatMap((a) => a.membres).map((m) => [m.id, m])).values()];
  const typesConnus = [...new Set(toutes.map((a) => a.type))];
  const tagsConnus = [...new Map(toutes.flatMap((a) => a.tags).map((tag) => [tag.slug, tag])).values()];

  const colonneListe = (
    <div className={`flex flex-col gap-3.5 ${detail ? "hidden lg:flex" : "flex"}`}>
      <SousOnglets actif={actif} />
      <FormulaireActivite membres={proches.map((p) => ({ id: p.id, prenom: p.first_name }))} />
      {toutes.length > 0 && <RechercheActivites />}

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

      {filtrees.length === 0 ? (
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
                  <span className="text-[13px] font-medium text-ink">{g.membre?.prenom ?? t("sansMembre")}</span>
                  <span className="text-[11.5px] text-muted">{t("compte", { n: g.activites.length })}</span>
                </header>
                <ul className="flex flex-col">
                  {g.activites.map((a) => (
                    <LigneActivite key={a.id} activite={a} aujourdhui={aujourdhui}
                      montrerStatut={actif === "tous"} selectionnee={a.id === selectedId} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (!detail) return colonneListe;

  return (
    <div data-testid="activites-liste-detail" className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-start lg:gap-7">
      {colonneListe}
      {/* La fiche colle en haut quand la liste défile : sur un grand écran, on
          parcourt la liste sans perdre de vue l'activité ouverte. */}
      <aside data-testid="activites-detail" className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
        {detail}
      </aside>
    </div>
  );
}
