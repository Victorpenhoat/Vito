"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { filtrerCave, facettesCave, trierParDerniereDegustation, SEUIL_COUP_DE_COEUR, type CaveFiltres, type VinCave } from "../domain/caveFilters";
import { VerresLecture } from "./NoteVerres";
import { AjouterVinButton } from "./AjouterVinButton";

// Cave (design Vins & Cave écran 5) : 6ᵉ sous-onglet de Restaurants. Le
// filtrage est en mémoire — une cave se compte en dizaines de bouteilles, et
// les facettes ont besoin de l'ensemble pour rester proposables.

type Onglet = "tous" | "coups_de_coeur" | "a_retrouver";
const ONGLETS: Onglet[] = ["tous", "coups_de_coeur", "a_retrouver"];

export function CavePanel({ vins, vinsConnus, tags }: {
  vins: VinCave[];
  vinsConnus: { id: string; cle: string; nb: number; dernier: string | null }[];
  tags: { id: string; slug: string; label: string; color: string | null }[];
}) {
  const t = useTranslations("vins");
  const [onglet, setOnglet] = useState<Onglet>("tous");
  const [q, setQ] = useState("");
  const [facettes, setFacettes] = useState<Pick<CaveFiltres, "couleur" | "region" | "cepage" | "noteMin" | "prixMax">>({});

  const dispo = useMemo(() => facettesCave(vins), [vins]);
  const visibles = useMemo(
    () => trierParDerniereDegustation(filtrerCave(vins, { onglet, q, ...facettes })),
    [vins, onglet, q, facettes],
  );

  const compte = (o: Onglet) => filtrerCave(vins, { onglet: o }).length;

  return (
    <div data-testid="cave-panel" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search size={14} className="pointer-events-none absolute left-3 text-faint" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="cave-recherche"
            placeholder={t("cave.recherche")} aria-label={t("cave.recherche")}
            className="w-full rounded-control border border-line bg-surface py-2 pl-8 pr-3 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
        </label>
        <AjouterVinButton vinsConnus={vinsConnus} tags={tags} />
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("cave.titre")}>
        {ONGLETS.map((o) => (
          <button key={o} type="button" role="tab" aria-selected={onglet === o}
            data-testid={`cave-onglet-${o}`} onClick={() => setOnglet(o)}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold ${
              onglet === o ? "border-accent/30 bg-accent-50 text-accent" : "border-line bg-surface-hover text-muted hover:text-ink"
            }`}>
            {t(`cave.onglets.${o}`)}
            <span className="ml-1 opacity-70">{compte(o)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Facette label={t("couleur")} value={facettes.couleur ?? ""} testId="cave-couleur"
          onChange={(v) => setFacettes((f) => ({ ...f, couleur: v || null }))}
          options={dispo.couleurs.map((c) => ({ value: c, label: t(`couleurs.${c}`) }))} />
        <Facette label={t("region")} value={facettes.region ?? ""} testId="cave-region"
          onChange={(v) => setFacettes((f) => ({ ...f, region: v || null }))}
          options={dispo.regions.map((r) => ({ value: r, label: r }))} />
        <Facette label={t("cepagesLabel")} value={facettes.cepage ?? ""} testId="cave-cepage"
          onChange={(v) => setFacettes((f) => ({ ...f, cepage: v || null }))}
          options={dispo.cepages.map((c) => ({ value: c, label: c }))} />
        <Facette label={t("note")} value={facettes.noteMin != null ? String(facettes.noteMin) : ""} testId="cave-note"
          onChange={(v) => setFacettes((f) => ({ ...f, noteMin: v ? Number(v) : null }))}
          options={[3, 4, 4.5].map((n) => ({ value: String(n), label: t("cave.noteMin", { n }) }))} />
        <Facette label={t("prix")} value={facettes.prixMax != null ? String(facettes.prixMax) : ""} testId="cave-prix"
          onChange={(v) => setFacettes((f) => ({ ...f, prixMax: v ? Number(v) : null }))}
          options={[20, 40, 80].map((p) => ({ value: String(p), label: t("cave.prixMax", { p }) }))} />
      </div>

      {visibles.length === 0 ? (
        <p data-testid="cave-vide" className="py-8 text-center text-sm text-muted">
          {vins.length === 0 ? t("cave.videTotal") : t("cave.videFiltre")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {visibles.map((v) => (
            <li key={v.id} data-testid="cave-row" className="border-b border-line-soft">
              <Link href={`/vins/${v.id}`} className="flex items-center gap-3 py-3 hover:bg-surface-hover">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14.5px] text-ink">
                      {[v.domaine ?? v.nom, v.appellation && v.appellation !== v.domaine ? v.appellation : null]
                        .filter(Boolean).join(" · ")}
                    </span>
                    {v.a_retrouver && (
                      <span className="shrink-0 rounded-full border border-accent/25 bg-accent-50 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                        {t("cave.onglets.a_retrouver")}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{sousTitre(v, t)}</span>
                </span>
                <VerresLecture note={v.note_moyenne} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** « Bandol 2021 · bu 3 fois · dernier : Kuzina » */
function sousTitre(v: VinCave, t: (k: string, p?: Record<string, string | number | Date>) => string): string {
  return [
    [v.appellation ?? v.region, v.millesime].filter(Boolean).join(" "),
    v.nb_degustations > 0 ? t("cave.buNFois", { n: v.nb_degustations }) : t("cave.jamaisBu"),
    v.dernier_lieu ? t("cave.dernierLieu", { lieu: v.dernier_lieu }) : null,
  ].filter(Boolean).join(" · ");
}

function Facette({ label, value, options, onChange, testId }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  testId: string;
}) {
  // Une facette sans valeur possible n'a rien à proposer : on la retire plutôt
  // que d'offrir un menu vide.
  if (options.length === 0) return null;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} aria-label={label}
      className={`rounded-full border px-2.5 py-1.5 text-[11.5px] font-semibold outline-none focus:outline-2 focus:outline-accent ${
        value ? "border-accent/30 bg-accent-50 text-accent" : "border-line bg-surface-hover text-muted"
      }`}>
      <option value="">{label}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export { SEUIL_COUP_DE_COEUR };
