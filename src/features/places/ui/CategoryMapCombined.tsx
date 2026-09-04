"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import type { Place } from "../domain/filterPlaces";
import { tagsForMap, filterByTag } from "../domain/mapFilters";
import { CATEGORY_UI, type CategorieUi } from "../domain/categoryUiConfig";
import { restoStatut, RESTO_STATUTS, type RestoStatut } from "@/features/restos/domain/statut";
import { CategoryMapLazy } from "./CategoryMapLazy";

// Sous-onglet Carte v2 (design écran 5 + desktop) : légende par statut TOGGLABLE,
// filtre par tags, compteur, liste synchronisée au survol (desktop). Brique
// générique Restos/Hôtels.
export function CategoryMapCombined({ places, categorie = "resto" }: { places: Place[]; categorie?: CategorieUi }) {
  const config = CATEGORY_UI[categorie];
  const t = useTranslations("places");
  const tr = useTranslations(config.ns);
  const [actifs, setActifs] = useState<Set<RestoStatut>>(new Set(RESTO_STATUTS));
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [surbrillance, setSurbrillance] = useState<string | null>(null);
  // Adresses visibles dans le cadrage (lot H5) : null tant que la carte n'a rien
  // dit — on ne prétend pas connaître la zone avant qu'elle soit rendue.
  const [zone, setZone] = useState<string[] | null>(null);

  const parStatut = places.filter((p) => actifs.has(restoStatut(p)));
  const filtered = filterByTag(parStatut, selectedTag);
  const tags = tagsForMap(places);

  // Le compteur et la liste suivent le cadrage là où les marqueurs se regroupent
  // (hôtels, éparpillés sur plusieurs pays). Les restos tiennent dans une ville :
  // leur compteur reste celui du filtre, comme au design Resto v2.
  const suitLaZone = config.map.clusters;
  const enZone = suitLaZone && zone ? filtered.filter((p) => zone.includes(p.id)) : filtered;

  function toggleStatut(s: RestoStatut) {
    setActifs((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const DOT: Record<RestoStatut, string> = {
    favori: "var(--accent)",
    a_tester: "var(--kpi-amber)",
    teste: "#8F867A",
  };

  const chipCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
      active ? "border-line bg-surface text-ink shadow-[0_2px_6px_rgba(33,30,26,.1)]" : "border-line bg-surface text-faint opacity-60"
    }`;

  return (
    <div className="flex flex-col gap-3">
      {/* légende togglable par statut */}
      <div data-testid="map-legend" className="flex flex-wrap gap-1.5">
        {RESTO_STATUTS.map((s) => (
          <button key={s} type="button" data-testid={`map-statut-${s}`} aria-pressed={actifs.has(s)}
            onClick={() => toggleStatut(s)} className={chipCls(actifs.has(s))}>
            <span className={`h-2 w-2 ${s === "teste" ? "rounded-[2px]" : "rounded-full"}`} style={{ backgroundColor: DOT[s] }} aria-hidden />
            {tr(`onglets.${s === "favori" ? "favoris" : s === "teste" ? config.slugTeste : "a_tester"}`)}
          </button>
        ))}
      </div>

      {/* filtre par tags */}
      {tags.length > 0 && (
        <div data-testid="map-tag-filter" className="flex flex-wrap gap-1.5">
          <button type="button" data-testid="map-tag-tous" aria-pressed={selectedTag === null} onClick={() => setSelectedTag(null)}
            className={`rounded-full px-3 py-1 text-[11px] ${selectedTag === null ? "bg-ink font-semibold text-app" : "border border-line bg-surface-hover text-muted"}`}>
            {t("tagTous")}
          </button>
          {tags.map((tag) => (
            <button key={tag.slug} type="button" data-testid={`map-tag-${tag.slug}`} aria-pressed={selectedTag === tag.slug}
              onClick={() => setSelectedTag(tag.slug)}
              className={`rounded-full px-3 py-1 text-[11px] ${selectedTag === tag.slug ? "bg-ink font-semibold text-app" : "border border-line bg-surface-hover text-muted"}`}>
              {tag.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end text-xs text-muted">
        <span data-testid="map-count">
          {suitLaZone ? t("adressesZone", { n: enZone.length }) : t("adressesCount", { n: filtered.length })}
        </span>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-4">
        {/* liste synchronisée (desktop) : survol → marqueur en surbrillance */}
        <aside data-testid="map-list" className="hidden lg:block lg:max-h-[60vh] lg:overflow-y-auto">
          <ul className="flex flex-col">
            {enZone.map((p) => {
              const s = restoStatut(p);
              return (
                <li key={p.id} data-testid="map-list-item"
                  onMouseEnter={() => setSurbrillance(p.id)} onMouseLeave={() => setSurbrillance(null)}
                  className={`border-b border-line-soft py-2 ${surbrillance === p.id ? "bg-surface-hover" : ""}`}>
                  <Link href={`${config.basePath}/${p.etablissement.id}`} className="flex items-center gap-2 text-sm text-accent hover:underline">
                    <span className={`h-2 w-2 shrink-0 ${s === "teste" ? "rounded-[2px]" : "rounded-full"}`} style={{ backgroundColor: DOT[s] }} aria-hidden />
                    <span className="truncate">
                      {p.etablissement.nom}
                      {p.etablissement.ville ? <span className="text-muted"> · {p.etablissement.ville}</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
        <CategoryMapLazy places={filtered} surbrillanceId={surbrillance} categorie={categorie}
          onZone={suitLaZone ? setZone : undefined} />
      </div>
    </div>
  );
}
