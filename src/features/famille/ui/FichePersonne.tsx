import { Link } from "@/lib/i18n/routing";
import { getTranslations, getLocale } from "next-intl/server";
import type { ProcheDetail, DocMeta } from "../data/queries";
import { DeleteProcheForm } from "./DeleteProcheForm";
import { Avatar } from "@/features/shared/ui/Avatar";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Button } from "@/features/shared/ui/Button";
import { RelationChip } from "./RelationChip";
import { DocumentRow } from "./DocumentRow";
import { formatDay } from "@/lib/format/date";

export async function FichePersonne({ proche, documents }: { proche: ProcheDetail; documents: DocMeta[] }) {
  const t = await getTranslations("famille");
  const locale = await getLocale();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Avatar name={`${proche.first_name} ${proche.last_name}`} size="xl" color={proche.avatar_color ?? undefined} />
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-ink">{proche.first_name} {proche.last_name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <RelationChip relation={proche.relation} />
            <span className="text-sm text-muted">{t(`circles.${proche.circle}`)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/famille/proches/${proche.id}/modifier`}><Button variant="ghost">{t("fiche.modifier")}</Button></Link>
          <DeleteProcheForm id={proche.id} label={t("form.supprimer")} confirmMsg={t("form.confirmSuppr")} />
        </div>
      </header>

      {(proche.phone || proche.email || proche.birth_date) && (
        <section className="flex flex-col gap-1">
          <SectionLabel>{t("fiche.contacts")}</SectionLabel>
          {proche.phone && <p className="text-ink">{proche.phone}</p>}
          {proche.email && <p className="text-ink">{proche.email}</p>}
          {proche.birth_date && <p className="text-muted">{t("fiche.naissance")} · {formatDay(proche.birth_date, locale)}</p>}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>{t("fiche.documents")}</SectionLabel>
        {documents.length === 0 ? (
          <p className="text-muted">{t("fiche.aucunDocument")}</p>
        ) : (
          <ul className="flex flex-col gap-2">{documents.map((d) => <DocumentRow key={d.id} doc={d} />)}</ul>
        )}
      </section>
    </div>
  );
}
