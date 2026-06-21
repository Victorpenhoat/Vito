import { getMesVins } from "../data/queries";
import { vinFiltersSchema } from "../domain/schemas";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function VinsList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = await getTranslations("vins");
  const filters = vinFiltersSchema.parse({
    couleur: searchParams.couleur, region: searchParams.region, noteMin: searchParams.noteMin,
    etablissementId: searchParams.etablissementId, dateFrom: searchParams.dateFrom, dateTo: searchParams.dateTo,
  });
  const vins = await getMesVins(filters);
  if (vins.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {vins.map((v) => (
        <li key={v.id} data-testid="vin-row" className="border p-3">
          <Link href={`/vins/${v.id}`}>
            <span className="font-semibold">{v.nom}</span>{" "}
            {v.millesime && <span>({v.millesime})</span>}{" "}
            {v.couleur && <span className="text-gray-500">· {t(`couleurs.${v.couleur}`)}</span>}{" "}
            <span className="text-gray-500">· {t("fois", { count: v.nb_degustations })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
