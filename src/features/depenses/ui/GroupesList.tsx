import { getMesGroupes } from "../data/queries";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function GroupesList() {
  const t = await getTranslations("depenses");
  const groupes = await getMesGroupes();
  if (groupes.length === 0) return <p className="text-sm text-muted">{t("vide")}</p>;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {groupes.map((g) => (
        <li key={g.id} data-testid="groupe-card">
          <Link href={`/depenses/${g.id}`} className="block rounded-card border border-line bg-surface p-5">
            <span className="block font-serif text-xl font-medium text-ink">{g.titre}</span>
            <span className="text-sm text-muted">{g.devise}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
