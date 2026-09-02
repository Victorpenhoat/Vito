"use client";
import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import { Link, usePathname, useRouter } from "@/lib/i18n/routing";
import { changerStatut } from "../data/actions";
import { filterPlaces, type Place } from "@/features/places/domain/filterPlaces";
import { tagsForMap, filterByTag } from "@/features/places/domain/mapFilters";
import { PlaceCard } from "@/features/places/ui/PlaceCard";
import { RestoDiscovery } from "./RestoDiscovery";
import { RestosMapCombined } from "./RestosMapCombined";
import { RestosMapLazy } from "./RestosMapLazy";
import { ArchivedPanel } from "@/features/places/ui/ArchivedPanel";
import { subsetForRestoStatut, restoStatut, type RestoStatut } from "../domain/statut";
import { VisiteForm } from "./VisiteForm";
import { Modal } from "@/features/shared/ui/Modal";

// Onglet Restaurants v2 (design Onglet_Resto_v2) : 5 sous-onglets Favoris /
// À tester / Testés / Tous / Carte pilotés par l'URL (?onglet=), recherche
// interne + « Trouver un restaurant » (recherche externe) accessibles partout.
// Hôtels reste sur PlacesTabs — ce composant est spécifique aux restos.

type Onglet = "favoris" | "a_tester" | "testes" | "tous" | "carte";
const ONGLETS: readonly Onglet[] = ["favoris", "a_tester", "testes", "tous", "carte"];
const TESTIDS: Record<Onglet, string> = {
  favoris: "tab-favoris", a_tester: "tab-a-tester", testes: "tab-testes", tous: "tab-tous", carte: "tab-carte",
};

type TagLite = { id: string; slug: string; label: string; color: string | null };

export function RestosTabs({ places, archived, tags }: { places: Place[]; archived: Place[]; tags: TagLite[] }) {
  const t = useTranslations("places");
  const tr = useTranslations("restos");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("onglet") ?? "";
  const onglet: Onglet = (ONGLETS as readonly string[]).includes(raw) ? (raw as Onglet) : "favoris";
  const [q, setQ] = useState("");
  const [view, setView] = useState<"liste" | "vignettes" | "carte">("liste");
  const [tag, setTag] = useState<string | null>(null);
  const [origine, setOrigine] = useState<"toutes" | "reco" | "trouve">("toutes");
  const [statutsFiltre, setStatutsFiltre] = useState<Set<RestoStatut>>(new Set());
  const [recherche, setRecherche] = useState(false);
  const [visitePour, setVisitePour] = useState<Place | null>(null);
  const [archives, setArchives] = useState(false);

  function selectOnglet(o: Onglet) {
    const params = new URLSearchParams(searchParams);
    if (o === "favoris") params.delete("onglet");
    else params.set("onglet", o);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const actifs =
    onglet === "tous" || onglet === "carte"
      ? statutsFiltre.size === 0 || onglet === "carte"
        ? places
        : places.filter((p) => statutsFiltre.has(restoStatut(p)))
      : subsetForRestoStatut(places, onglet === "testes" ? "teste" : onglet === "a_tester" ? "a_tester" : "favori");

  const filtresOrigine =
    onglet === "a_tester" && origine !== "toutes"
      ? actifs.filter((p) => p.origine_type === origine)
      : actifs;
  const shown = filterByTag(filterPlaces(filtresOrigine, q), tag);
  const triees =
    onglet === "testes"
      ? [...shown].sort((a, b) => (b.derniere_visite?.visite_le ?? "").localeCompare(a.derniere_visite?.visite_le ?? ""))
      : shown;
  const tagsDispo = tagsForMap(filtresOrigine);

  function toggleStatutFiltre(s: RestoStatut) {
    setStatutsFiltre((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <div data-testid="restos-tabs" className="flex flex-col gap-3.5">
      {/* sous-onglets */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 [scrollbar-width:none]" role="tablist">
        {ONGLETS.map((o) => {
          const active = onglet === o;
          return (
            <button key={o} type="button" role="tab" id={`tab-${o}`} aria-controls="restos-panel"
              data-testid={TESTIDS[o]} aria-selected={active} onClick={() => selectOnglet(o)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                active ? "bg-ink font-semibold text-app" : "border border-line bg-surface text-muted hover:bg-surface-hover"
              }`}>
              {tr(`onglets.${o}`)}
            </button>
          );
        })}
      </div>

      {/* recherche interne + Trouver */}
      {onglet !== "carte" && (
        <div className="flex gap-2.5">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-line bg-surface px-3.5 py-2.5">
            <Search size={15} className="shrink-0 text-faint" aria-hidden />
            <input type="search" data-testid="places-search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={tr("rechercherPlaceholder")} aria-label={tr("rechercherPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden" />
          </label>
          <button type="button" data-testid="trouver-restaurant" onClick={() => setRecherche(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-accent/25 bg-accent-50 px-3.5 py-2.5 text-xs font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
            <Plus size={13} aria-hidden />
            {tr("trouver")}
          </button>
          <div className="flex shrink-0 gap-1 rounded-control border border-line p-0.5">
            {(["liste", "vignettes", "carte"] as const).map((v) => (
              <button key={v} type="button" data-testid={`view-${v}`} aria-pressed={view === v}
                aria-label={t(`vue${v.charAt(0).toUpperCase()}${v.slice(1)}`)} onClick={() => setView(v)}
                className={`rounded-[2px] px-2 py-1.5 text-xs ${view === v ? "bg-accent text-white" : "text-muted"}`}>
                {v === "liste" ? "☰" : v === "vignettes" ? "▦" : "◍"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* filtres contextuels */}
      {onglet === "a_tester" && (
        <div className="flex gap-1.5">
          {(["toutes", "reco", "trouve"] as const).map((o) => (
            <button key={o} type="button" data-testid={`origine-${o}`} aria-pressed={origine === o} onClick={() => setOrigine(o)}
              className={`rounded-full px-3 py-1.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                origine === o ? "bg-ink font-semibold text-app" : "border border-line bg-surface-hover text-muted"
              }`}>
              {tr(`origines.filtre_${o}`)}
            </button>
          ))}
        </div>
      )}
      {onglet === "tous" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(["favori", "a_tester", "teste"] as const).map((s) => (
            <button key={s} type="button" data-testid={`statut-${s}`} aria-pressed={statutsFiltre.has(s)} onClick={() => toggleStatutFiltre(s)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                statutsFiltre.has(s) ? "border border-accent/25 bg-accent-50 text-accent" : "border border-line bg-surface-hover text-muted"
              }`}>
              {tr(`statut.${s === "teste" ? "teste" : s}`)}{statutsFiltre.has(s) ? " ✓" : ""}
            </button>
          ))}
          <span data-testid="tous-count" className="ml-auto text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            {t("adressesCount", { n: triees.length })}
          </span>
        </div>
      )}
      {onglet !== "carte" && tagsDispo.length > 0 && (
        <div data-testid="list-tag-filter" className="flex flex-wrap items-center gap-1.5">
          <button type="button" data-testid="list-tag-tous" aria-pressed={tag === null} onClick={() => setTag(null)}
            className={`rounded-full px-3 py-1 text-[11px] ${tag === null ? "bg-ink font-semibold text-app" : "border border-line bg-surface-hover text-muted"}`}>
            {t("tagTous")}
          </button>
          {tagsDispo.map((tg) => (
            <button key={tg.slug} type="button" data-testid={`list-tag-${tg.slug}`} aria-pressed={tag === tg.slug} onClick={() => setTag(tg.slug)}
              className={`rounded-full px-3 py-1 text-[11px] ${tag === tg.slug ? "bg-ink font-semibold text-app" : "border border-line bg-surface-hover text-muted"}`}>
              {tg.label}
            </button>
          ))}
          <Link href="/restos/tags" className="ml-auto text-[11px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
            {tr("tags.gerer")}
          </Link>
        </div>
      )}

      {archived.length > 0 && (
        <button type="button" data-testid="tab-archives" aria-pressed={archives} onClick={() => setArchives((v) => !v)}
          className={`self-start text-xs ${archives ? "font-semibold text-ink" : "text-muted"}`}>
          {t("archives")} <span className="text-faint">({archived.length})</span>
        </button>
      )}
      {archives && <ArchivedPanel places={archived} />}

      {/* panneau */}
      {!archives && (
      <div role="tabpanel" id="restos-panel" aria-labelledby={`tab-${onglet}`} data-testid="places-panel">
        {onglet === "carte" ? (
          <RestosMapCombined places={places} />
        ) : triees.length === 0 ? (
          <EtatVide onglet={onglet} filtre={q.trim() !== "" || tag !== null} q={q} t={tr} onTrouver={() => setRecherche(true)} />
        ) : view === "carte" ? (
          <RestosMapLazy places={triees} />
        ) : view === "vignettes" ? (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {triees.map((p) => <PlaceCard key={p.id} place={p} variant="vignette" />)}
          </ul>
        ) : (
          <ul className="divide-y divide-line">
            {triees.map((p) => (
              <li key={p.id} className="relative">
                <ul><PlaceCard place={p} variant="liste" /></ul>
                <RowExtras place={p} onglet={onglet} tr={tr} onVisite={() => setVisitePour(p)} />
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      {/* recherche externe priorisée (écran 7) — le statut proposé suit le sous-onglet */}
      <Modal open={recherche} onClose={() => setRecherche(false)} title={tr("trouverTitre")}>
        <RestoDiscovery places={places}
          statutDefaut={onglet === "favoris" ? "favori" : onglet === "testes" ? "teste" : "a_tester"} />
      </Modal>

      {/* marquer une visite depuis la liste */}
      <Modal open={visitePour !== null} onClose={() => setVisitePour(null)} title={visitePour ? tr("visite.titre", { nom: visitePour.etablissement.nom }) : ""}>
        {visitePour && (
          <VisiteForm listeItemId={visitePour.id} tags={tags} onDone={() => setVisitePour(null)} />
        )}
      </Modal>
    </div>
  );
}

function RowExtras({ place: p, onglet, tr, onVisite }: {
  place: Place; onglet: Onglet; tr: ReturnType<typeof useTranslations>; onVisite: () => void;
}) {
  if (onglet === "a_tester") {
    return (
      <div className="flex items-center justify-between gap-2 pb-3 pl-[84px] -mt-1.5">
        {p.origine_type && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
            p.origine_type === "reco" ? "border-current/20 bg-kpi-amber-bg text-kpi-amber" : "border-line bg-surface-hover text-muted"
          }`}>
            {p.origine_type === "reco"
              ? tr("origines.recoPar", { qui: p.origine_qui ?? "?" })
              : tr("origines.trouvePar", { source: p.origine_source ?? "—" })}
          </span>
        )}
        <button type="button" data-testid="marquer-visite" onClick={onVisite}
          className="ml-auto shrink-0 rounded-full border border-current/20 bg-kpi-green-bg px-3 py-1 text-[10.5px] font-semibold text-kpi-green focus-visible:outline-2 focus-visible:outline-accent">
          ✓ {tr("visite.cta")}
        </button>
      </div>
    );
  }
  if (onglet === "testes") {
    return (
      <div className="flex items-center justify-between gap-2 pb-3 pl-[84px] -mt-1.5">
        <span className="text-[11px] text-faint">
          {p.derniere_visite?.visite_le ? tr("visite.visiteLe", { date: p.derniere_visite.visite_le }) : ""}
          {p.derniere_visite?.note != null ? ` · ${p.derniere_visite.note.toLocaleString("fr-FR")}` : ""}
        </span>
        <PasserFavoriButton listeItemId={p.id} label={tr("passerFavori")} />
      </div>
    );
  }
  return null;
}

function PasserFavoriButton({ listeItemId, label }: { listeItemId: string; label: string }) {
  const [, action, pending] = useActionState(changerStatut, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="listeItemId" value={listeItemId} />
      <input type="hidden" name="statut" value="favori" />
      <button type="submit" data-testid="passer-favori" disabled={pending}
        className="shrink-0 rounded-full border border-accent/25 bg-accent-50 px-3 py-1 text-[10.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
        ♥ {label}
      </button>
    </form>
  );
}

function EtatVide({ onglet, filtre, q, t, onTrouver }: {
  onglet: Onglet; filtre: boolean; q: string; t: ReturnType<typeof useTranslations>; onTrouver: () => void;
}) {
  return (
    <div data-testid="place-empty-state" className="flex flex-col items-center px-8 py-16 text-center">
      <span className="mb-5 grid h-[84px] w-[84px] place-items-center rounded-full border border-line bg-surface-hover">
        <Search size={30} className="text-faint" aria-hidden />
      </span>
      <h2 className="font-serif text-xl font-medium text-ink">
        {filtre ? t("vide.aucunResultat") : t(`vide.${onglet}Titre`)}
      </h2>
      <p className="mt-2 mb-5 max-w-sm text-sm leading-relaxed text-muted">
        {filtre ? t("vide.aucunResultatTexte", { q: q.trim() }) : t(`vide.${onglet}Texte`)}
      </p>
      <button type="button" onClick={onTrouver}
        className="inline-flex items-center gap-2 rounded-control bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(37,99,235,.3)] focus-visible:outline-2 focus-visible:outline-accent">
        <Search size={15} aria-hidden />
        {filtre && q.trim() ? t("vide.chercherExterne", { q: q.trim() }) : t("trouverTitre")}
      </button>
    </div>
  );
}
