"use client";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, ChevronRight } from "lucide-react";
import { Link, usePathname, useRouter } from "@/lib/i18n/routing";
import { formatRange } from "@/lib/format/date";
import { VOYAGE_CHIPS, voyageChip, joursAvant, nuits, type VoyageChip } from "../domain/affichageVoyage";
import { VoyageCover } from "./VoyageCover";

export type VoyageRow = {
  id: string;
  titre: string;
  destination: string | null;
  date_debut: string | null;
  date_fin: string | null;
  statut: string;
  periode_texte: string | null;
  cover_photo_ref: string | null;
  cover_url: string | null;
};

const CHIP_TONE: Record<VoyageChip, string> = {
  a_venir: "border-accent/25 bg-accent-50 text-accent",
  en_cours: "border-current/20 bg-kpi-green-bg text-kpi-green",
  en_preparation: "border-current/20 bg-kpi-amber-bg text-kpi-amber",
  idees: "border-line bg-surface-hover text-muted",
  termines: "border-line bg-surface-hover text-muted",
};

// Liste des voyages (design Onglet_Voyages, écran 1) : sous-onglets par statut,
// cards à couverture + compte à rebours, lignes « idée » compactes.
export function VoyagesList({ voyages, today }: { voyages: VoyageRow[]; today: string }) {
  const t = useTranslations("voyages");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // sous-onglet piloté par l'URL (?chip=…) : survit au refresh/reload-guards e2e,
  // partageable — même pattern que les filtres de RechercheForm.
  const raw = searchParams.get("chip") ?? "";
  const chip: VoyageChip = (VOYAGE_CHIPS as readonly string[]).includes(raw) ? (raw as VoyageChip) : "a_venir";
  function selectChip(c: VoyageChip) {
    const params = new URLSearchParams(searchParams);
    if (c === "a_venir") params.delete("chip");
    else params.set("chip", c);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const filtered = voyages.filter((v) => voyageChip(v.statut, v.date_debut, v.date_fin, today) === chip);

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 [scrollbar-width:none]">
        {VOYAGE_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => selectChip(c)}
            aria-pressed={chip === c}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              chip === c ? "bg-ink font-semibold text-app" : "border border-line bg-surface text-muted hover:bg-surface-hover"
            }`}
          >
            {t(`chips.${c}`)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{t("videChip")}</p>
      ) : (
        <ul className="flex flex-col gap-3.5 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:items-start">
          {filtered.map((v) =>
            v.statut === "idee" ? <IdeeRow key={v.id} voyage={v} t={t} /> : <Carte key={v.id} voyage={v} t={t} locale={locale} today={today} />,
          )}
        </ul>
      )}
    </div>
  );
}

function Carte({ voyage: v, t, locale, today }: {
  voyage: VoyageRow; t: ReturnType<typeof useTranslations>; locale: string; today: string;
}) {
  const chip = voyageChip(v.statut, v.date_debut, v.date_fin, today);
  const dans = chip === "a_venir" ? joursAvant(v.date_debut, today) : null;
  const n = nuits(v.date_debut, v.date_fin);
  const dates = formatRange(v.date_debut, v.date_fin, locale);
  const sub = [dates || v.periode_texte, n ? t("nuits", { n }) : null].filter(Boolean).join(" · ");
  return (
    <li data-testid="voyage-card" className={chip === "termines" ? "opacity-70" : ""}>
      <Link href={`/voyages/${v.id}`} className="block overflow-hidden rounded-[6px] border border-line bg-surface focus-visible:outline-2 focus-visible:outline-accent">
        <VoyageCover photoRef={v.cover_photo_ref} url={v.cover_url} statut={v.statut} className="h-[150px]">
          {dans !== null && (
            <span className="absolute left-3 top-3 rounded-full bg-accent/95 px-2.5 py-1 text-[10.5px] font-semibold text-white">
              {t("dansNJours", { n: dans })}
            </span>
          )}
        </VoyageCover>
        <div className="p-3.5 pb-4">
          <div className="flex items-start justify-between gap-2">
            <span className="font-serif text-xl text-ink">{v.titre}</span>
            <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CHIP_TONE[chip]}`}>
              {t(`chips.${chip}`)}
            </span>
          </div>
          {sub && <div className="mt-0.5 text-[12.5px] text-faint">{sub}</div>}
        </div>
      </Link>
    </li>
  );
}

function IdeeRow({ voyage: v, t }: { voyage: VoyageRow; t: ReturnType<typeof useTranslations> }) {
  return (
    <li data-testid="voyage-card">
      <Link href={`/voyages/${v.id}`}
        className="flex items-center gap-2.5 rounded-[6px] border border-dashed border-line px-3.5 py-3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent">
        <Sparkles size={18} className="shrink-0 text-faint" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          <span className="text-[13px] font-medium text-ink">{v.titre}</span>
          <span className="text-xs text-faint">{v.periode_texte ? ` · ${v.periode_texte}` : ""} — {t("chips.idee_courte")}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[11.5px] font-semibold text-accent">
          {t("preparer")}
          <ChevronRight size={13} aria-hidden />
        </span>
      </Link>
    </li>
  );
}
