"use client";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { type Place } from "../domain/filterPlaces";
import { TAB_VIEWS, subsetForTab, type PlacesTab } from "../domain/placesTabsConfig";
import { PlaceListPanel } from "./PlaceListPanel";
import { PlaceDiscovery } from "./PlaceDiscovery";
import { PlacesMapCombined } from "./PlacesMapCombined";
import { ArchivedPanel } from "./ArchivedPanel";

export function PlacesTabs({ category, places, archived }: { category: "resto" | "hotel"; places: Place[]; archived: Place[] }) {
  const t = useTranslations("places");
  const locale = useLocale();
  const [tab, setTab] = useState<PlacesTab | "archives">("favoris");

  const favoris = subsetForTab(places, "favoris");
  const recommandes = subsetForTab(places, "recommandes");
  // Carte combinée intérimaire : union favoris + recommandés, dédupliquée par id.
  const cartePlaces = Array.from(new Map([...favoris, ...recommandes].map((p) => [p.id, p])).values());

  const tabs: { key: PlacesTab; testid: string; label: string; count?: number }[] = [
    { key: "favoris", testid: "tab-favoris", label: t("favoris"), count: favoris.length },
    { key: "recommandes", testid: "tab-recommandes", label: t("recommandes"), count: recommandes.length },
    { key: "carte", testid: "tab-carte", label: t("carte") },
    { key: "recherche", testid: "tab-recherche", label: t("recherche") },
  ];

  return (
    <div data-testid="places-tabs" className="flex flex-col gap-4">
      <div className="flex gap-6 border-b border-line" role="tablist">
        {tabs.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              type="button"
              role="tab"
              id={`tab-${it.key}`}
              aria-controls={`panel-${it.key}`}
              data-testid={it.testid}
              aria-selected={active}
              onClick={() => setTab(it.key)}
              className={`-mb-px border-b-2 pb-3 text-sm ${active ? "border-ink font-semibold text-ink" : "border-transparent text-muted"}`}
            >
              {it.label}
              {it.count !== undefined && <span className="text-faint"> · {it.count}</span>}
            </button>
          );
        })}
      </div>
      {archived.length > 0 && (
        <button
          type="button"
          data-testid="tab-archives"
          aria-pressed={tab === "archives"}
          onClick={() => setTab("archives")}
          className={`self-start text-xs ${tab === "archives" ? "font-semibold text-ink" : "text-muted"}`}
        >
          {t("archives")} <span className="text-faint">({archived.length})</span>
        </button>
      )}
      {tab !== "archives" && (
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} data-testid="places-panel">
          {tab === "favoris" && <PlaceListPanel places={favoris} views={TAB_VIEWS.favoris} locale={locale} category={category} />}
          {tab === "recommandes" && <PlaceListPanel places={recommandes} views={TAB_VIEWS.recommandes} locale={locale} category={category} />}
          {tab === "carte" && <PlacesMapCombined places={cartePlaces} locale={locale} />}
          {tab === "recherche" && <PlaceDiscovery places={places} category={category} />}
        </div>
      )}
      {tab === "archives" && <ArchivedPanel places={archived} />}
    </div>
  );
}
