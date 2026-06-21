import { getMesGroupes } from "../data/queries";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function GroupesList() {
  const t = await getTranslations("depenses");
  const groupes = await getMesGroupes();
  if (groupes.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {groupes.map((g) => (
        <li key={g.id} data-testid="groupe-card" className="border p-3">
          <Link href={`/depenses/${g.id}`}>
            <span className="font-semibold">{g.titre}</span>{" "}
            <span className="text-gray-500">· {g.devise}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
