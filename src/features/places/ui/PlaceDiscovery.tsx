"use client";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchPlaces, addResto, addHotel } from "@/features/restos/data/actions";
import type { Place } from "../domain/filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";
import { searchEnvies, markOwned, addRecent, removeRecent } from "../domain/discovery";
import { Button } from "@/features/shared/ui/Button";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export function PlaceDiscovery({ places, category }: { places: Place[]; category: "resto" | "hotel" }) {
  const t = useTranslations("places");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const storageKey = `vito.recents.${category}`;
  const addAction = category === "hotel" ? addHotel : addResto;
  const envies = searchEnvies(category);
  const testidBase = category === "hotel" ? "hotel" : "resto";

  useEffect(() => {
    // Hydratation depuis localStorage après montage : pattern SSR-safe volontaire
    // (un init paresseux provoquerait un mismatch d'hydratation serveur/client).
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setRecents(JSON.parse(raw) as string[]);
    } catch {
      /* localStorage indisponible : on ignore */
    }
  }, [storageKey]);

  const persistRecents = (next: string[]) => {
    setRecents(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const runSearch = (query: string) => {
    const term = query.trim();
    if (!term) return;
    setQ(query);
    setSearched(true);
    persistRecents(addRecent(recents, term));
    start(async () => setResults(await searchPlaces(term)));
  };

  const clear = () => {
    setQ("");
    setResults([]);
    setSearched(false);
    setAddError(null);
  };

  const owned = markOwned(results, places);

  return (
    <div className="flex flex-col gap-4">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); runSearch(q); }}>
        <input
          data-testid={`add-${testidBase}-search`}
          placeholder={t("searchDecouvertePlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
        />
        {searched && (
          <Button type="button" variant="ghost" data-testid="search-clear" onClick={clear}>✕</Button>
        )}
        <Button type="submit" data-testid="search-submit" pending={pending}>{t("rechercher")}</Button>
      </form>

      {addError && <p role="alert" className="text-sm text-danger">{addError}</p>}

      {!searched && (
        <>
          {recents.length > 0 && (
            <section data-testid="recents">
              <SectionLabel>{t("recherchesRecentes")}</SectionLabel>
              <ul className="flex flex-col">
                {recents.map((r) => (
                  <li key={r} data-testid="recent-item" className="flex items-center gap-2 border-b border-line-soft py-2">
                    <button type="button" className="flex-1 text-left text-sm text-ink" onClick={() => runSearch(r)}>{r}</button>
                    <button type="button" aria-label={t("retirerRecherche")} className="px-1 text-faint" onClick={() => persistRecents(removeRecent(recents, r))}>✕</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {envies.length > 0 && (
            <section data-testid="envies">
              <SectionLabel>{t("explorerEnvie")}</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {envies.map((e) => (
                  <button
                    key={e.labelKey}
                    type="button"
                    data-testid={`envie-${e.labelKey}`}
                    onClick={() => runSearch(e.query)}
                    className="flex items-center gap-2 rounded-card border border-line bg-surface px-3.5 py-3.5 text-left text-sm text-ink"
                  >
                    <span className="text-base">{e.emoji}</span>
                    {t(e.labelKey)}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {searched && results.length > 0 && (
        <ul className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-6">
          {owned.map(({ result, owned: isOwned }) => {
            const added = isOwned || addedIds.has(result.placeId);
            return (
              <li key={result.placeId} data-testid="search-result" className="flex items-center justify-between gap-3 border-b border-line-soft py-3">
                <span className="min-w-0">
                  <span className="font-serif text-base text-ink">{result.nom}</span>
                  {result.adresse ? <span className="text-sm text-muted"> · {result.adresse}</span> : null}
                </span>
                {added ? (
                  <span data-testid="result-added" className="shrink-0 rounded-full bg-badge px-3 py-1 text-xs font-semibold text-ink">{t("ajoute")}</span>
                ) : (
                  <form action={(fd) => start(async () => {
                    const res = await addAction(undefined, fd);
                    if (res?.error) setAddError(res.error);
                    else { setAddError(null); setAddedIds((s) => new Set(s).add(result.placeId)); }
                  })}>
                    <input type="hidden" name="placeId" value={result.placeId} />
                    <Button type="submit" variant="ghost" pending={pending}>{t("add")}</Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {searched && !pending && results.length === 0 && (
        <p className="text-sm text-muted">{t("empty")}</p>
      )}
    </div>
  );
}
