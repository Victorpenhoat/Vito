import { getTranslations, getLocale } from "next-intl/server";
import { formatRange } from "@/lib/format/date";
import { Link } from "@/lib/i18n/routing";
import { statutTint } from "../domain/statutTint";
import { getVoyageMeta } from "../data/queries";

type Voyage = { id: string; titre: string; destination: string | null; date_debut: string | null; date_fin: string | null; statut: string };

export async function VoyageFeatured({ voyage }: { voyage: Voyage }) {
  const t = await getTranslations("voyages");
  const locale = await getLocale();
  const meta = await getVoyageMeta(voyage.id);
  const dates = formatRange(voyage.date_debut, voyage.date_fin, locale);
  const sub = [voyage.destination, dates].filter(Boolean).join(" · ");
  const metaLine = [
    t("metaReservations", { count: meta.reservations }),
    t("metaMembres", { count: meta.voyageurs }),
    t("metaDocuments", { count: meta.documents }),
  ].join(" · ");
  return (
    <div data-testid="voyage-card">
      <Link href={`/voyages/${voyage.id}`} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface md:flex-row">
        <div className="relative h-40 md:h-auto md:w-2/5" style={{ background: statutTint(voyage.statut) }}>
          <span className="absolute left-4 top-4 rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">{t(`statuts.${voyage.statut}`)}</span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-6">
          <h3 className="font-serif text-2xl font-medium text-ink">{voyage.titre}</h3>
          {sub && <p className="text-sm text-muted">{sub}</p>}
          <p className="mt-auto pt-3 text-sm text-faint">{metaLine}</p>
        </div>
      </Link>
    </div>
  );
}
