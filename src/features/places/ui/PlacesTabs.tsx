"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { filterPlaces, type Place } from "../domain/filterPlaces";
import { PlaceCard } from "./PlaceCard";

type Tab = "tous" | "favoris" | "a_tester" | "visites";

export function PlacesTabs({ category: _category, places }: { category: "resto" | "hotel"; places: Place[] }) {
  const t = useTranslations("places");
  const [tab, setTab] = useState<Tab>("tous");
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
      <input
        data-testid="places-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
      />
      {shown.length === 0 ? (
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
