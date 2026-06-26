"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations, useLocale } from "next-intl";
import { filterPlaces, type Place } from "../domain/filterPlaces";
import { PlaceCard } from "./PlaceCard";

const PlacesMap = dynamic(() => import("./PlacesMap").then((m) => m.PlacesMap), { ssr: false });

type Tab = "tous" | "favoris" | "a_tester" | "visites";
type View = "liste" | "carte";

export function PlacesTabs({ category: _category, places }: { category: "resto" | "hotel"; places: Place[] }) {
  const t = useTranslations("places");
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("tous");
  const [view, setView] = useState<View>("liste");
  const [q, setQ] = useState("");

  const subset = (k: Tab) =>
    k === "favoris" ? places.filter((p) => p.is_favorite)
    : k === "a_tester" ? places.filter((p) => p.statut === "a_faire")
    : k === "visites" ? places.filter((p) => p.statut === "visite")
    : places;

  const tabs: { key: Tab; testid: string; label: string }[] = [
    { key: "tous", testid: "tab-tous", label: t("tous") },
    { key: "favoris", testid: "tab-favoris", label: t("favoris") },
    { key: "a_tester", testid: "tab-a-tester", label: t("aTester") },
    { key: "visites", testid: "tab-visites", label: t("visites") },
  ];
  const views: { key: View; testid: string; label: string }[] = [
    { key: "liste", testid: "view-liste", label: t("vueListe") },
    { key: "carte", testid: "view-carte", label: t("vueCarte") },
  ];

  const shown = filterPlaces(subset(tab), q);

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
              data-testid={it.testid}
              aria-selected={active}
              onClick={() => setTab(it.key)}
              className={`-mb-px border-b-2 pb-3 text-sm ${active ? "border-ink font-semibold text-ink" : "border-transparent text-muted"}`}
            >
              {it.label} <span className="text-faint">· {subset(it.key).length}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <input
          data-testid="places-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
        />
        <div className="flex gap-1 rounded-control border border-line p-0.5">
          {views.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                data-testid={v.testid}
                aria-pressed={active}
                onClick={() => setView(v.key)}
                className={`rounded-[2px] px-3 py-1 text-sm ${active ? "bg-accent text-white" : "text-muted"}`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>
      {view === "carte" ? (
        <PlacesMap places={shown} locale={locale} />
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {shown.map((p) => (
            <PlaceCard key={p.id} place={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
