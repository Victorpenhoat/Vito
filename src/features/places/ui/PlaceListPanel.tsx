"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { filterPlaces, type Place } from "../domain/filterPlaces";
import type { PlaceView } from "../domain/placesTabsConfig";
import { categoryConfig } from "../domain/categoryConfig";
import { tagsForMap, filterByTag } from "../domain/mapFilters";
import { PlaceCard } from "./PlaceCard";
import { PlacesMapLazy } from "./PlacesMapLazy";

function chipCls(active: boolean): string {
  return `whitespace-nowrap rounded-control border px-3 py-1 text-xs ${active ? "border-transparent bg-accent text-white" : "border-line text-muted"}`;
}

export function PlaceListPanel({
  places,
  views,
  locale,
  category,
}: {
  places: Place[];
  views: PlaceView[];
  locale: string;
  category: "resto" | "hotel";
}) {
  const t = useTranslations("places");
  const [q, setQ] = useState("");
  const [view, setView] = useState<PlaceView>(views[0]!);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const showTagFilter = categoryConfig[category].listTagFilter;
  const tags = showTagFilter ? tagsForMap(places) : [];
  const shown = filterByTag(filterPlaces(places, q), selectedTag);
  const gridCls =
    view === "vignettes"
      ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      : "grid grid-cols-1 gap-5 sm:grid-cols-2";
  const viewLabel: Record<PlaceView, string> = {
    liste: t("vueListe"),
    vignettes: t("vueVignettes"),
    carte: t("vueCarte"),
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="places-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("filtrerPlaceholder")}
          className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
        />
        {views.length > 1 && (
          <div className="flex gap-1 rounded-control border border-line p-0.5">
            {views.map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`view-${v}`}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-[2px] px-3 py-1 text-sm ${view === v ? "bg-accent text-white" : "text-muted"}`}
              >
                {viewLabel[v]}
              </button>
            ))}
          </div>
        )}
      </div>
      {showTagFilter && tags.length > 0 && (
        <div data-testid="list-tag-filter" className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="list-tag-tous"
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
              data-testid={`list-tag-${tag.slug}`}
              aria-pressed={selectedTag === tag.slug}
              onClick={() => setSelectedTag(tag.slug)}
              className={chipCls(selectedTag === tag.slug)}
            >
              {tag.label}
            </button>
          ))}
        </div>
      )}
      {view === "carte" ? (
        <PlacesMapLazy places={shown} locale={locale} />
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className={gridCls}>
          {shown.map((p) => (
            <PlaceCard key={p.id} place={p} variant={view === "vignettes" ? "vignette" : "liste"} />
          ))}
        </ul>
      )}
    </div>
  );
}
