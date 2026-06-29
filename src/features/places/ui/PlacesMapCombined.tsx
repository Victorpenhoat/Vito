"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Place } from "../domain/filterPlaces";
import { tagsForMap, filterByTag } from "../domain/mapFilters";
import { PlacesMapLazy } from "./PlacesMapLazy";
import { Link } from "@/lib/i18n/routing";

export function PlacesMapCombined({ places, locale }: { places: Place[]; locale: string }) {
  const t = useTranslations("places");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const tags = tagsForMap(places);
  const filtered = filterByTag(places, selectedTag);

  const chipCls = (active: boolean) =>
    `whitespace-nowrap rounded-control border px-3 py-1 text-xs ${active ? "border-transparent bg-accent text-white" : "border-line text-muted"}`;

  return (
    <div className="flex flex-col gap-3">
      <div data-testid="map-tag-filter" className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="map-tag-tous"
          aria-pressed={selectedTag === null}
          onClick={() => setSelectedTag(null)}
          className={chipCls(selectedTag === null)}
        >
          {t("tagTous")}
        </button>
        {tags.map((tag) => (
          <button
            key={tag.slug}
            type="button"
            data-testid={`map-tag-${tag.slug}`}
            aria-pressed={selectedTag === tag.slug}
            onClick={() => setSelectedTag(tag.slug)}
            className={chipCls(selectedTag === tag.slug)}
          >
            {tag.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <div data-testid="map-legend" className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: "var(--gold)" }} />
            {t("favoris")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 bg-surface" style={{ borderColor: "var(--accent)" }} />
            {t("recommandes")}
          </span>
        </div>
        <span data-testid="map-count">{t("adressesCount", { n: filtered.length })}</span>
      </div>
      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-4">
        <aside data-testid="map-list" className="hidden lg:block lg:max-h-[60vh] lg:overflow-y-auto">
          <ul className="flex flex-col">
            {filtered.map((p) => {
              const base = p.etablissement.categorie === "hotel" ? "hotels" : "restos";
              return (
                <li key={p.id} data-testid="map-list-item" className="border-b border-line-soft py-2">
                  <Link href={`/${base}/${p.etablissement.id}`} className="text-sm text-accent hover:underline">
                    {p.etablissement.nom}
                    {p.etablissement.ville ? <span className="text-muted"> · {p.etablissement.ville}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
        <PlacesMapLazy places={filtered} locale={locale} />
      </div>
    </div>
  );
}
