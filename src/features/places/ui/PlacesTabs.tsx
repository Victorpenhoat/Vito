"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { filterPlaces, type Place } from "../domain/filterPlaces";
import { PlaceCard } from "./PlaceCard";

export function PlacesTabs({ category: _category, places }: { category: "resto" | "hotel"; places: Place[] }) {
  const t = useTranslations("places");
  const [tab, setTab] = useState<"favoris" | "a_tester">("favoris");
  const [q, setQ] = useState("");
  const base = tab === "favoris" ? places.filter((p) => p.is_favorite) : places.filter((p) => p.statut === "a_faire");
  const shown = filterPlaces(base, q);
  const tabCls = (active: boolean) =>
    `flex-1 rounded-lg py-2 text-sm font-semibold ${active ? "bg-surface text-ink shadow-sm" : "text-muted"}`;
  return (
    <div data-testid="places-tabs" className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-canvas p-1" role="tablist">
        <button
          type="button"
          role="tab"
          data-testid="tab-favoris"
          aria-selected={tab === "favoris"}
          onClick={() => setTab("favoris")}
          className={tabCls(tab === "favoris")}
        >
          {t("favoris")}
        </button>
        <button
          type="button"
          role="tab"
          data-testid="tab-a-tester"
          aria-selected={tab === "a_tester"}
          onClick={() => setTab("a_tester")}
          className={tabCls(tab === "a_tester")}
        >
          {t("aTester")}
        </button>
      </div>
      <input
        data-testid="places-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
      />
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((p) => (
            <PlaceCard key={p.id} place={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
