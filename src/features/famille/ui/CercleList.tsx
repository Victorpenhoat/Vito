"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, MessageCircle, Phone, Plus, Search, X } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import type { Proche } from "../data/queries";
import { Avatar } from "@/features/shared/ui/Avatar";
import { ExpiryBadge } from "./ExpiryBadge";
import { groupProches, matchesQuery } from "../domain/groupes";

// Liste du cercle (design Onglet_Cercle, écrans 1 & 6) : recherche live,
// « moi » épinglé, groupes Mon foyer / Parents / Amis & autres, lignes plates.
export function CercleList({ proches }: { proches: Proche[] }) {
  const t = useTranslations("famille");
  const [q, setQ] = useState("");

  const relLabel = (r: string) => t(`relations.${r}`);
  const filtered = proches.filter((p) => matchesQuery([`${p.first_name} ${p.last_name}`, relLabel(p.relation)], q));
  const { moi, groupes } = groupProches(filtered);
  const searching = q.trim() !== "";

  return (
    <div className="flex flex-1 flex-col gap-0">
      <label className={`flex items-center gap-2.5 rounded-control border bg-surface px-3.5 py-3 ${searching ? "border-accent" : "border-line"}`}>
        <Search size={16} className="shrink-0 text-faint" aria-hidden />
        <input
          type="search"
          data-testid="cercle-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("proches.rechercher")}
          aria-label={t("proches.rechercher")}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
        />
        {searching && (
          <button type="button" onClick={() => setQ("")} aria-label={t("proches.effacer")}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-line text-muted focus-visible:outline-2 focus-visible:outline-accent">
            <X size={11} aria-hidden />
          </button>
        )}
      </label>

      {filtered.length === 0 ? (
        <div data-testid="cercle-aucun-resultat" className="flex flex-1 flex-col items-center justify-center px-8 py-20 text-center">
          <span className="mb-5 grid h-[84px] w-[84px] place-items-center rounded-full border border-line bg-surface-hover">
            <Search size={32} className="text-faint" aria-hidden />
          </span>
          <h2 className="font-serif text-xl font-medium text-ink">{t("proches.aucunResultat")}</h2>
          <p className="mt-2 mb-5 text-sm leading-relaxed text-muted">{t("proches.aucunResultatTexte", { q: q.trim() })}</p>
          <Link href={`/famille/proches/nouveau?prenom=${encodeURIComponent(q.trim())}`}
            className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent">
            <Plus size={15} className="text-accent" aria-hidden />
            {t("proches.ajouterAuCercle", { q: q.trim() })}
          </Link>
        </div>
      ) : (
        <ul className="mt-2 flex flex-col">
          {moi && <Row key={moi.id} proche={moi} t={t} pinned />}
          {groupes.map((g) => (
            <li key={g.key}>
              <div className="mt-5 mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t(`groupes.${g.key}`)}</div>
              <ul className="flex flex-col">
                {g.items.map((p) => <Row key={p.id} proche={p} t={t} />)}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {!searching && (
        <Link href="/famille/foyer"
          className="mt-8 inline-flex items-center gap-1 self-start text-sm font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
          {t("proches.foyerLien")}
          <ChevronRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Row({ proche: p, t, pinned = false }: { proche: Proche; t: ReturnType<typeof useTranslations>; pinned?: boolean }) {
  const urgent = p.urgency === "expired" || p.urgency === "soon";
  return (
    <li data-testid="proche-row" className="flex items-center gap-3 border-b border-line-soft">
      <Link href={`/famille/proches/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3.5 py-3.5 focus-visible:outline-2 focus-visible:outline-accent">
        <Avatar name={`${p.first_name} ${p.last_name}`} size="lg" color={p.avatar_color ?? undefined} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-[17px] text-ink">{p.first_name} {p.last_name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-faint">{t(`relations.${p.relation}`)}</span>
            {urgent && (
              <ExpiryBadge status={p.urgency as "expired" | "soon"} monthsLeft={p.urgency_months ?? undefined}
                docLabel={p.urgency_doc_type ? t(`docTypesShort.${p.urgency_doc_type}`) : undefined} dot />
            )}
          </span>
        </span>
      </Link>
      {pinned ? (
        <span className="shrink-0 rounded-full border border-accent/25 bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold text-accent">{t("proches.epingle")}</span>
      ) : p.phone ? (
        <span className="flex shrink-0 gap-2">
          <a href={`tel:${p.phone}`} aria-label={t("fiche.appeler")}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
            <Phone size={14} aria-hidden />
          </a>
          <a href={`sms:${p.phone}`} aria-label={t("fiche.message")}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
            <MessageCircle size={14} aria-hidden />
          </a>
        </span>
      ) : (
        <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
      )}
    </li>
  );
}
