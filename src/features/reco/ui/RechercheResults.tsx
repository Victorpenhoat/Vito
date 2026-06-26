import { getTranslations } from "next-intl/server";
import { rechercheRestos } from "../data/queries";
import { rechercheCriteriaSchema } from "../domain/schemas";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Link } from "@/lib/i18n/routing";

type Row = { id: string; nom: string; type: string | null; ville: string | null; arrondissement: string | null; photo_ref: string | null };

function ResultRow({ e }: { e: Row }) {
  const photoUrl = e.photo_ref ? `/api/places/photo?ref=${encodeURIComponent(e.photo_ref)}&w=200` : null;
  const initial = e.nom.charAt(0).toUpperCase();
  const subtitle = [e.type, e.arrondissement ?? e.ville].filter(Boolean).join(" · ");
  return (
    <li data-testid="resto-result">
      <Link href={`/restos/${e.id}`} className="flex items-center gap-4 border-b border-line-soft py-3">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-control bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={e.nom} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-serif text-lg text-faint">{initial}</span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-serif text-lg text-ink">{e.nom}</span>
          {subtitle && <span className="block text-sm text-muted">{subtitle}</span>}
        </span>
      </Link>
    </li>
  );
}

export async function RechercheResults({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = await getTranslations("recherche");
  const criteria = rechercheCriteriaSchema.parse({
    zone: searchParams.zone, budgetMax: searchParams.budgetMax, type: searchParams.type, ambiance: searchParams.ambiance,
  });
  const { maListe, recos } = await rechercheRestos(criteria);
  return (
    <div className="flex flex-col gap-8">
      <section data-testid="ma-liste-section">
        <SectionLabel>{t("maListe")}</SectionLabel>
        {maListe.length === 0 ? <p className="text-sm text-muted">{t("vide")}</p> : <ul className="flex flex-col">{maListe.map((e) => <ResultRow key={e.id} e={e} />)}</ul>}
      </section>
      <section data-testid="recos-section">
        <SectionLabel>{t("recos")}</SectionLabel>
        {recos.length === 0 ? <p className="text-sm text-muted">{t("vide")}</p> : <ul className="flex flex-col">{recos.map((e) => <ResultRow key={e.id} e={e} />)}</ul>}
      </section>
    </div>
  );
}
