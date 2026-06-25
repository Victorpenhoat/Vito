import { getMesVins } from "../data/queries";
import { vinFiltersSchema } from "../domain/schemas";
import { couleurTint } from "../domain/couleurTint";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function VinsList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = await getTranslations("vins");
  const filters = vinFiltersSchema.parse({
    couleur: searchParams.couleur, region: searchParams.region, noteMin: searchParams.noteMin,
    etablissementId: searchParams.etablissementId, dateFrom: searchParams.dateFrom, dateTo: searchParams.dateTo,
  });
  const vins = await getMesVins(filters);
  if (vins.length === 0) return <p className="text-sm text-muted">{t("vide")}</p>;
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {vins.map((v) => {
        const eyebrow = [v.region, v.couleur ? t(`couleurs.${v.couleur}`) : null].filter(Boolean).join(" · ");
        return (
          <li key={v.id} data-testid="vin-row">
            <Link href={`/vins/${v.id}`} className="block overflow-hidden rounded-card border border-line bg-surface">
              <div className="h-32" style={{ background: couleurTint(v.couleur) }} />
              <div className="flex flex-col gap-1 p-4">
                {eyebrow && <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{eyebrow}</span>}
                <span className="font-serif text-xl font-medium text-ink">
                  {v.nom}{v.millesime ? ` ${v.millesime}` : ""}
                </span>
                <div className="mt-1 flex items-center justify-between text-sm text-muted">
                  <span>{t("fois", { count: v.nb_degustations })}</span>
                  {v.derniere_note != null && <span className="text-ink">{v.derniere_note}/5</span>}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
