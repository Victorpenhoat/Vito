import { getTranslations } from "next-intl/server";
import { getMaListe } from "../data/queries";
import { Link } from "@/lib/i18n/routing";

export async function RestoList() {
  const t = await getTranslations("restos");
  const items = await getMaListe();
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => {
        const etab = Array.isArray(it.etablissement) ? it.etablissement[0] : it.etablissement;
        if (!etab) return null;
        return (
          <li key={it.id} data-testid="resto-card" className="border p-3 flex justify-between">
            <Link href={`/restos/${etab.id}`}>
              {etab.nom} {it.is_favorite ? <span aria-label={t("favorite")}>★</span> : null} <span className="text-gray-500">({etab.type ?? "—"})</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
