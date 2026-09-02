import { ChevronLeft, FileText, Mail, MapPin, MessageCircle, Phone, Plus } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { getTranslations, getLocale } from "next-intl/server";
import type { ProcheDetail, DocMeta } from "../data/queries";
import { Avatar } from "@/features/shared/ui/Avatar";
import { Button } from "@/features/shared/ui/Button";
import { CopyButton } from "@/features/shared/ui/CopyButton";
import { DocumentRow } from "./DocumentRow";
import { IDENTITY_DOC_TYPES } from "../domain/schemas";
import { ageYears } from "../domain/age";
import { formatDay } from "@/lib/format/date";

// Fiche membre (design Onglet_Cercle, écrans 2 & 7b) : en-tête centré, actions
// rapides, sections Contact / Identité / Documents complémentaires.
export async function FichePersonne({
  proche,
  documents,
  foyerAddress,
}: {
  proche: ProcheDetail;
  documents: DocMeta[];
  foyerAddress: string | null;
}) {
  const t = await getTranslations("famille");
  const locale = await getLocale();
  const fullName = `${proche.first_name} ${proche.last_name}`;
  const age = ageYears(proche.birth_date, new Date());
  const inherited = proche.address_inherit && !!foyerAddress;
  const address = inherited ? foyerAddress : proche.address;
  const identite = documents.filter((d) => IDENTITY_DOC_TYPES.includes(d.doc_type));
  const complementaires = documents.filter((d) => !IDENTITY_DOC_TYPES.includes(d.doc_type));

  const quickActions = [
    proche.phone && { href: `tel:${proche.phone}`, label: t("fiche.appeler"), icon: Phone },
    proche.phone && { href: `sms:${proche.phone}`, label: t("fiche.message"), icon: MessageCircle },
    proche.email && { href: `mailto:${proche.email}`, label: t("fiche.email"), icon: Mail },
    address && { href: `https://maps.apple.com/?q=${encodeURIComponent(address)}`, label: t("fiche.itineraire"), icon: MapPin },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Phone }[];

  return (
    <div className="flex flex-col">
      {/* barre haute : retour + modifier */}
      <div className="flex items-center justify-between">
        <Link href="/famille" className="inline-flex items-center gap-1 py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronLeft size={16} aria-hidden />
          {t("cercleTitre")}
        </Link>
        <Link href={`/famille/proches/${proche.id}/modifier`} className="py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
          {t("fiche.modifier")}
        </Link>
      </div>

      {/* en-tête centré */}
      <header className="flex flex-col items-center border-b border-line pb-5 pt-2 text-center">
        <Avatar name={fullName} size="xl" color={proche.avatar_color ?? undefined} />
        <h1 className="mt-3 font-serif text-2xl font-medium text-ink">{fullName}</h1>
        <div className="mt-0.5 text-[13px] text-faint">
          {t(`relations.${proche.relation}`)}
          {age !== null && <> · {t("fiche.age", { n: age })}</>}
        </div>
        {quickActions.length > 0 && (
          <div className="mt-4 flex gap-3">
            {quickActions.map((a) => (
              <div key={a.label} className="flex flex-col items-center gap-1.5">
                <a href={a.href} aria-label={a.label} {...(a.href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}
                  className="grid h-[46px] w-[46px] place-items-center rounded-full border border-line bg-surface text-accent transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent">
                  <a.icon size={17} aria-hidden />
                </a>
                <span className="text-[10.5px] text-muted">{a.label}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      <div className="flex flex-col gap-6 pt-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
        {/* Contact */}
        {(proche.phone || proche.email || address || proche.birth_date) && (
          <section className="flex flex-col">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("fiche.contact")}</h2>
            <div className="divide-y divide-line-soft overflow-hidden rounded-[5px] border border-line bg-surface">
              {proche.phone && <ContactRow label={t("form.telephone")} value={proche.phone} copy />}
              {proche.email && <ContactRow label={t("form.email")} value={proche.email} copy />}
              {address && (
                <ContactRow label={t("form.adresse")} value={address} copy
                  chip={inherited ? t("fiche.heriteeFoyer") : undefined} />
              )}
              {proche.birth_date && (
                <ContactRow
                  label={t("fiche.naissance")}
                  value={`${formatDay(proche.birth_date, locale)}${proche.birth_place ? ` · ${proche.birth_place}` : ""}`}
                />
              )}
            </div>
          </section>
        )}

        <div className="flex flex-col gap-6">
          {documents.length === 0 ? (
            /* état vide (écran 7b) */
            <div className="flex flex-col items-center rounded-[6px] border border-dashed border-line bg-surface px-6 py-8 text-center">
              <FileText size={30} className="text-faint" aria-hidden />
              <div className="mt-3 font-serif text-lg text-ink">{t("fiche.aucunDocTitre")}</div>
              <p className="mt-1.5 mb-4 max-w-xs text-[12.5px] leading-relaxed text-muted">{t("fiche.aucunDocTexte")}</p>
              <Link href={`/famille/proches/${proche.id}/documents/nouveau`}>
                <Button className="inline-flex items-center gap-2 py-2.5 text-[12.5px]">
                  <Plus size={14} aria-hidden />
                  {t("tunnel.ajouterDocument")}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {identite.length > 0 && (
                <section className="flex flex-col">
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("fiche.identite")}</h2>
                  <ul className="divide-y divide-line-soft overflow-hidden rounded-[5px] border border-line bg-surface">
                    {identite.map((d) => <DocumentRow key={d.id} doc={d} memberId={proche.id} />)}
                  </ul>
                </section>
              )}
              <section className="flex flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("fiche.docsComplementaires")}</h2>
                  <Link href={`/famille/proches/${proche.id}/documents/nouveau`} aria-label={t("tunnel.ajouterDocument")}
                    className="text-[12.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
                    + {t("ajouter")}
                  </Link>
                </div>
                {complementaires.length > 0 ? (
                  <ul className="divide-y divide-line-soft overflow-hidden rounded-[5px] border border-line bg-surface">
                    {complementaires.map((d) => <DocumentRow key={d.id} doc={d} memberId={proche.id} />)}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t("fiche.aucunDocument")}</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactRow({ label, value, copy = false, chip }: { label: string; value: string; copy?: boolean; chip?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <div className="min-w-0">
        <div className="text-[11px] text-faint">{label}</div>
        <div className="mt-0.5 break-words text-sm text-ink">{value}</div>
        {chip && (
          <span className="mt-1.5 inline-flex items-center rounded-full border border-line bg-surface-hover px-2 py-0.5 text-[10.5px] text-muted">
            {chip}
          </span>
        )}
      </div>
      {copy && <CopyButtonServerBoundary value={value} />}
    </div>
  );
}

// petit pont serveur→client : CopyButton a besoin d'un label traduit côté serveur
async function CopyButtonServerBoundary({ value }: { value: string }) {
  const t = await getTranslations("famille");
  return <CopyButton value={value} label={t("fiche.copier")} />;
}
