"use client";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, LocateFixed } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { searchPlaces, addResto } from "../data/actions";
import type { Place } from "@/features/places/domain/filterPlaces";
import type { PlaceSummary, SearchOpts } from "@/lib/services/places/types";
import { searchEnvies, addRecent, removeRecent } from "@/features/places/domain/discovery";
import { restoStatut, RESTO_STATUTS, type RestoStatut } from "../domain/statut";
import { haversineKm, formatDistance } from "../domain/distance";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

// Recherche externe priorisée (design Onglet_Resto_v2, écran 7) : « Déjà dans
// Vito » d'abord (avec statut), puis résultats externes enrichis (photo, ouvert,
// distance) ; l'ajout propose le statut du sous-onglet d'origine. Spécifique
// restos — les hôtels gardent PlaceDiscovery.

const CUISINES = ["italian_restaurant", "japanese_restaurant", "french_restaurant", "pizza_restaurant"] as const;

export function RestoDiscovery({ places, statutDefaut }: { places: Place[]; statutDefaut: RestoStatut }) {
  const t = useTranslations("places");
  const tr = useTranslations("restos");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [openNow, setOpenNow] = useState(false);
  const [prix, setPrix] = useState<number | null>(null);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [rayon, setRayon] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState<string | null>(null);
  const [prixOuvert, setPrixOuvert] = useState(false);
  const [cuisineOuverte, setCuisineOuverte] = useState(false);
  const storageKey = "vito.recents.resto";
  const envies = searchEnvies("resto");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation localStorage SSR-safe (pattern PlaceDiscovery)
      if (raw) setRecents(JSON.parse(raw) as string[]);
    } catch { /* localStorage indisponible */ }
  }, []);

  const persistRecents = (next: string[]) => {
    setRecents(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const buildOpts = (pos = position): SearchOpts => ({
    ...(openNow ? { openNow: true } : {}),
    ...(prix ? { priceLevels: [prix] } : {}),
    ...(cuisine ? { includedType: cuisine } : {}),
    ...(pos && rayon ? { center: pos, radiusKm: 2 } : {}),
  });

  const runSearch = (query: string, pos = position) => {
    const term = query.trim();
    if (!term) return;
    setQ(query);
    setSearched(true);
    persistRecents(addRecent(recents, term));
    start(async () => setResults(await searchPlaces(term, buildOpts(pos))));
  };

  const clear = () => {
    setQ("");
    setResults([]);
    setSearched(false);
    setAddError(null);
  };

  function toggleRayon() {
    if (rayon) { setRayon(false); if (searched) runSearch(q); return; }
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPosition(pos);
        setRayon(true);
        if (searched) runSearch(q, pos);
      },
      () => { /* géoloc refusée : chip inactif */ },
    );
  }

  // owned = déjà dans Vito (par place_id), priorisés en tête
  const byPlaceId = new Map(places.map((p) => [p.etablissement.place_id, p]));
  const owned = results.flatMap((r) => {
    const place = byPlaceId.get(r.placeId);
    return place ? [{ result: r, place }] : [];
  });
  const externes = results.filter((r) => !byPlaceId.has(r.placeId));

  const chipCls = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
      active ? "border border-current/20 bg-kpi-green-bg font-semibold text-kpi-green" : "border border-line bg-surface-hover text-muted"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); runSearch(q); }}>
        <Input data-testid="add-resto-search" placeholder={t("searchDecouvertePlaceholder")}
          value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 text-sm" />
        {searched && (
          <Button type="button" variant="ghost" data-testid="search-clear" onClick={clear}>✕</Button>
        )}
        <Button type="submit" data-testid="search-submit" pending={pending}>{t("rechercher")}</Button>
      </form>

      {/* filtres (relancent la recherche en cours) */}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" data-testid="filtre-ouvert" aria-pressed={openNow} className={chipCls(openNow)}
          onClick={() => { setOpenNow((v) => { const n = !v; return n; }); if (searched) setTimeout(() => runSearch(q), 0); }}>
          {tr("recherche.ouvertMnt")}{openNow ? " ✓" : ""}
        </button>
        <div className="relative">
          <button type="button" aria-expanded={prixOuvert} className={chipCls(prix !== null)} onClick={() => setPrixOuvert((v) => !v)}>
            {prix ? "€".repeat(prix) : tr("recherche.prix")} ▾
          </button>
          {prixOuvert && (
            <div className="absolute z-10 mt-1 flex flex-col overflow-hidden rounded-[6px] border border-line bg-surface shadow-lg">
              {[null, 1, 2, 3, 4].map((n) => (
                <button key={String(n)} type="button"
                  className="px-4 py-2 text-left text-sm text-ink hover:bg-surface-hover"
                  onClick={() => { setPrix(n); setPrixOuvert(false); if (searched) setTimeout(() => runSearch(q), 0); }}>
                  {n === null ? tr("recherche.tousPrix") : "€".repeat(n)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button type="button" aria-expanded={cuisineOuverte} className={chipCls(cuisine !== null)} onClick={() => setCuisineOuverte((v) => !v)}>
            {cuisine ? tr(`recherche.cuisines.${cuisine}`) : tr("recherche.cuisine")} ▾
          </button>
          {cuisineOuverte && (
            <div className="absolute z-10 mt-1 flex flex-col overflow-hidden rounded-[6px] border border-line bg-surface shadow-lg">
              <button type="button" className="px-4 py-2 text-left text-sm text-ink hover:bg-surface-hover"
                onClick={() => { setCuisine(null); setCuisineOuverte(false); if (searched) setTimeout(() => runSearch(q), 0); }}>
                {tr("recherche.toutesCuisines")}
              </button>
              {CUISINES.map((c) => (
                <button key={c} type="button" className="px-4 py-2 text-left text-sm text-ink hover:bg-surface-hover"
                  onClick={() => { setCuisine(c); setCuisineOuverte(false); if (searched) setTimeout(() => runSearch(q), 0); }}>
                  {tr(`recherche.cuisines.${c}`)}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" data-testid="filtre-rayon" aria-pressed={rayon} className={chipCls(rayon)} onClick={toggleRayon}>
          <LocateFixed size={11} className="mr-1 inline" aria-hidden />
          {tr("recherche.rayon")}{rayon ? " ✓" : ""}
        </button>
      </div>

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
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {envies.map((e) => (
                  <button key={e.labelKey} type="button" data-testid={`envie-${e.labelKey}`} onClick={() => runSearch(e.query)}
                    className="flex items-center gap-2 rounded-card border border-line bg-surface px-3.5 py-3.5 text-left text-sm text-ink">
                    <span className="text-base">{e.emoji}</span>
                    {t(e.labelKey)}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {searched && owned.length > 0 && (
        <section>
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent">{tr("recherche.dejaDansVito")}</div>
          <ul className="flex flex-col">
            {owned.map(({ result, place }) => {
              const s = restoStatut(place);
              return (
                <li key={result.placeId} data-testid="search-result" className="border-b border-line-soft">
                  <Link href={`/restos/${place.etablissement.id}`} className="flex items-center gap-3 py-2.5 focus-visible:outline-2 focus-visible:outline-accent">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-serif text-base text-ink">{result.nom}</span>
                        <span data-testid="result-added" className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${
                          s === "favori" ? "border-accent/25 bg-accent-50 text-accent"
                          : s === "a_tester" ? "border-current/20 bg-kpi-amber-bg text-kpi-amber"
                          : "border-line bg-surface-hover text-muted"
                        }`}>
                          {s === "favori" ? "♥ " : ""}{tr(`statut.${s}`)}
                        </span>
                      </span>
                      {result.adresse && <span className="block truncate text-xs text-muted">{result.adresse}</span>}
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-faint" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {searched && externes.length > 0 && (
        <section>
          {owned.length > 0 && (
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">{tr("recherche.resultatsExternes")}</div>
          )}
          <ul className="flex flex-col">
            {externes.map((r) => {
              const added = addedIds.has(r.placeId);
              const dist = position && r.lat != null && r.lng != null
                ? formatDistance(haversineKm(position, { lat: r.lat, lng: r.lng }), locale)
                : null;
              return (
                <li key={r.placeId} data-testid="search-result" className="flex items-center gap-3 border-b border-line-soft py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-base text-ink">{r.nom}</span>
                    <span className="block truncate text-xs text-muted">
                      {[r.adresse, dist].filter(Boolean).join(" · ")}
                      {r.openNow ? <span className="font-semibold text-kpi-green"> · {tr("recherche.ouvert")}</span> : null}
                    </span>
                  </span>
                  {added ? (
                    <span data-testid="result-added" className="shrink-0 rounded-full bg-badge px-3 py-1 text-xs font-semibold text-ink">{t("ajoute")}</span>
                  ) : (
                    <span className="relative flex shrink-0 items-center gap-1">
                      <form action={(fd) => start(async () => {
                        const res = await addResto(undefined, fd);
                        if (res?.error) setAddError(res.error);
                        else { setAddError(null); setAddedIds((s) => new Set(s).add(r.placeId)); }
                      })}>
                        <input type="hidden" name="placeId" value={r.placeId} />
                        <input type="hidden" name="statutV2" value={statutDefaut} />
                        <button type="submit" disabled={pending}
                          className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-app focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
                          + {tr(`statut.${statutDefaut}`)}
                        </button>
                      </form>
                      <button type="button" aria-label={tr("recherche.choisirStatut")} aria-expanded={menuOuvert === r.placeId}
                        onClick={() => setMenuOuvert((m) => (m === r.placeId ? null : r.placeId))}
                        className="grid h-7 w-7 place-items-center rounded-full border border-line bg-surface text-muted focus-visible:outline-2 focus-visible:outline-accent">
                        <ChevronDown size={12} aria-hidden />
                      </button>
                      {menuOuvert === r.placeId && (
                        <span className="absolute right-0 top-9 z-10 flex w-36 flex-col overflow-hidden rounded-[6px] border border-line bg-surface shadow-lg">
                          {RESTO_STATUTS.map((s) => (
                            <form key={s} action={(fd) => start(async () => {
                              setMenuOuvert(null);
                              const res = await addResto(undefined, fd);
                              if (res?.error) setAddError(res.error);
                              else { setAddError(null); setAddedIds((prev) => new Set(prev).add(r.placeId)); }
                            })}>
                              <input type="hidden" name="placeId" value={r.placeId} />
                              <input type="hidden" name="statutV2" value={s} />
                              <button type="submit" className="w-full px-3.5 py-2 text-left text-sm text-ink hover:bg-surface-hover">
                                {s === "favori" ? "♥ " : ""}{tr(`statut.${s}`)}
                              </button>
                            </form>
                          ))}
                        </span>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-center text-[10.5px] text-faint">{tr("recherche.statutSuit")}</p>
        </section>
      )}

      {searched && !pending && results.length === 0 && (
        <p className="text-sm text-muted">{t("emptyRecherche")}</p>
      )}
    </div>
  );
}
