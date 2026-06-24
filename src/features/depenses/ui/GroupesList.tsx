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
        <li key={g.id} data-testid="groupe-card" className="rounded-card border border-line bg-surface p-4">
          <Link href={`/depenses/${g.id}`} className="text-accent hover:underline">
            <span className="font-semibold text-ink">{g.titre}</span>{" "}
            <span className="text-muted">· {g.devise}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
