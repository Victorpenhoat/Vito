import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Plane, Hotel, Car, Home, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { formatRange, formatDay } from "@/lib/format/date";
import { getVoyageDetail, getVoyageDocuments } from "../data/queries";
import { voyageChip, joursAvant, nuits } from "../domain/affichageVoyage";
import { VoyageCover } from "./VoyageCover";
import { ShareVoyageButton } from "./ShareVoyageButton";
import { ReservationForm } from "./ReservationForm";
import { ShareForm } from "./ShareForm";
import { MembersList } from "./MembersList";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { DocumentsList } from "./DocumentsList";
import { openVoyageGroupe } from "@/features/depenses/data/actions";
import { Avatar } from "@/features/shared/ui/Avatar";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

const TYPE_ICONS: Record<string, LucideIcon> = {
  vol: Plane,
  hotel: Hotel,
  voiture: Car,
  hebergement: Home,
  autre: Ticket,
};

// Fiche voyage (design Onglet_Voyages, écran 3) : héros couverture, ancres,
// participants, prochaine étape, tuiles. Programme/Dépenses intégrées : lots B/D.
export async function VoyageDetail({ id }: { id: string }) {
  const t = await getTranslations("voyages");
  const locale = await getLocale();
  const detail = await getVoyageDetail(id);
  if (!detail) notFound();
  const { voyage, reservations, membres, isOwner } = detail;
  const documents = await getVoyageDocuments(voyage.id);

  const today = new Date().toISOString().slice(0, 10);
  const chip = voyageChip(voyage.statut, voyage.date_debut, voyage.date_fin, today);
  const dans = chip === "a_venir" ? joursAvant(voyage.date_debut, today) : null;
  const n = nuits(voyage.date_debut, voyage.date_fin);
  const dates = formatRange(voyage.date_debut, voyage.date_fin, locale);
  const sub = [dates || voyage.periode_texte, n ? t("nuits", { n }) : null].filter(Boolean).join(" · ");
  const prochaine = [...reservations]
    .filter((r) => r.date_debut && r.date_debut >= today)
    .sort((a, b) => (a.date_debut! < b.date_debut! ? -1 : 1))[0] ?? null;

  const ancres = [
    { href: "#reservations", label: t("reservations") },
    { href: "#documents", label: t("documents.titre") },
    { href: "#partage", label: t("fiche.partage") },
  ];

  return (
    <article className="flex flex-col">
      {/* héros couverture */}
      <VoyageCover photoRef={voyage.cover_photo_ref} url={voyage.cover_url} statut={voyage.statut} className="h-56 rounded-card md:h-64">
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <Link href="/voyages" aria-label={t("retourListe")}
            className="grid h-[38px] w-[38px] place-items-center rounded-full bg-surface/95 text-ink shadow focus-visible:outline-2 focus-visible:outline-accent">
            <ChevronLeft size={16} aria-hidden />
          </Link>
          <div className="flex gap-2">
            <ShareVoyageButton titre={voyage.titre} />
            <Link href={`/voyages/${voyage.id}/modifier`} aria-label={t("modifierTitre")}
              className="grid h-[38px] w-[38px] place-items-center rounded-full bg-surface/95 text-ink shadow focus-visible:outline-2 focus-visible:outline-accent">
              <Pencil size={15} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="absolute inset-x-5 bottom-4 text-white">
          <span className="rounded-full bg-accent/95 px-2.5 py-1 text-[10px] font-semibold">
            {t(`chips.${chip}`)}{dans !== null ? ` · ${t("dansNJoursCourt", { n: dans })}` : ""}
          </span>
          <h1 className="mt-2 font-serif text-3xl font-medium md:text-4xl">{voyage.titre}</h1>
          {sub && <p className="mt-0.5 text-[13px] opacity-90">{voyage.destination && voyage.destination !== voyage.titre ? `${voyage.destination} · ` : ""}{sub}</p>}
        </div>
      </VoyageCover>

      {/* ancres */}
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto border-b border-line px-4 pb-3 md:mx-0 md:px-0 [scrollbar-width:none]">
        <span className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-app">{t("fiche.apercu")}</span>
        {ancres.map((a) => (
          <a key={a.href} href={a.href}
            className="shrink-0 whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-muted hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent">
            {a.label}
          </a>
        ))}
      </div>

      {/* aperçu : participants, prochaine étape, tuiles */}
      <div className="mt-4 flex flex-col gap-4">
        <div>
          <SectionLabel>{t("fiche.participants")}</SectionLabel>
          <div className="flex items-center gap-3 rounded-[5px] border border-line bg-surface px-3.5 py-3">
            <div className="flex">
              {membres.slice(0, 4).map((m, i) => (
                <span key={m.profile_id} className={i > 0 ? "-ml-2" : ""}>
                  <Avatar name={m.display_name ?? "?"} size="sm" color={m.role === "owner" ? "#211E1A" : undefined} />
                </span>
              ))}
            </div>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
              {membres.map((m) => (m.display_name ?? "").split(" ")[0]).filter(Boolean).join(", ")}
            </span>
            {isOwner && (
              <span className="shrink-0 rounded-full border border-accent/25 bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent">{t("fiche.organisateur")}</span>
            )}
          </div>
        </div>

        {prochaine && (
          <div>
            <SectionLabel>{t("fiche.prochaineEtape")}</SectionLabel>
            <div className="flex items-center gap-3 rounded-[5px] border border-line bg-surface px-3.5 py-3">
              <ProchaineIcone type={prochaine.type} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-ink">
                  {[prochaine.fournisseur, prochaine.reference].filter(Boolean).join(" · ") || t(`types.${prochaine.type}`)}
                </div>
                <div className="mt-0.5 text-xs text-faint">{formatDay(prochaine.date_debut, locale)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <a href="#reservations" className="rounded-[5px] border border-line bg-surface px-3.5 py-3 focus-visible:outline-2 focus-visible:outline-accent">
            <div className="text-[11px] text-faint">{t("reservations")}</div>
            <div className="mt-0.5 font-serif text-xl text-ink">{reservations.length}</div>
          </a>
          <a href="#documents" className="rounded-[5px] border border-line bg-surface px-3.5 py-3 focus-visible:outline-2 focus-visible:outline-accent">
            <div className="text-[11px] text-faint">{t("documents.titre")}</div>
            <div className="mt-0.5 font-serif text-xl text-ink">{documents.length}</div>
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <section id="reservations" className="scroll-mt-4">
            <SectionLabel>{t("reservations")}</SectionLabel>
            <ul className="flex flex-col">
              {reservations.map((r) => (
                <li key={r.id} data-testid="reservation-row" className="flex flex-col gap-0.5 border-b border-line-soft py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{t(`types.${r.type}`)}</span>
                  <span className="font-serif text-lg text-ink">{[r.fournisseur, r.reference].filter(Boolean).join(" · ") || t(`types.${r.type}`)}</span>
                  {(r.date_debut || r.date_fin) && <span className="text-sm text-muted">{formatRange(r.date_debut, r.date_fin, locale)}</span>}
                  <span className="flex flex-wrap gap-3 text-sm">
                    {r.conciergerie_tel && <a href={`tel:${r.conciergerie_tel}`} className="text-accent hover:underline">{r.conciergerie_tel}</a>}
                    {r.conciergerie_mail && <a href={`mailto:${r.conciergerie_mail}`} className="text-accent hover:underline">{r.conciergerie_mail}</a>}
                    {r.lien && <a href={r.lien} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t("voirLien")}</a>}
                  </span>
                </li>
              ))}
            </ul>
            <ReservationForm voyageId={voyage.id} />
          </section>

          <section id="documents" data-testid="documents-section" className="scroll-mt-4">
            <SectionLabel>{t("documents.titre")}</SectionLabel>
            <DocumentsList voyageId={voyage.id} documents={documents} />
            <DocumentUploadForm voyageId={voyage.id} />
          </section>
        </div>

        <aside id="partage" className="flex scroll-mt-4 flex-col gap-6">
          <Card>
            <SectionLabel>{t("membres")}</SectionLabel>
            <MembersList voyageId={voyage.id} membres={membres} isOwner={isOwner} />
            {isOwner && <ShareForm voyageId={voyage.id} />}
          </Card>
          <Card>
            <SectionLabel>{t("depenses")}</SectionLabel>
            <form action={openVoyageGroupe}>
              <input type="hidden" name="voyageId" value={voyage.id} />
              <button type="submit" className="text-sm font-semibold text-accent hover:underline">{t("ouvrirCompte")}</button>
            </form>
          </Card>
        </aside>
      </div>
    </article>
  );
}

async function ProchaineIcone({ type }: { type: string }) {
  const Icon = TYPE_ICONS[type] ?? Ticket;
  return (
    <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-accent-50 text-accent">
      <Icon size={16} aria-hidden />
    </span>
  );
}
