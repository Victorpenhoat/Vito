import { getMesVoyages } from "../data/queries";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function VoyagesList() {
  const t = await getTranslations("voyages");
  const voyages = await getMesVoyages();
  if (voyages.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {voyages.map((v) => (
        <li key={v.id} data-testid="voyage-card" className="rounded-card border border-line bg-surface p-4">
          <Link href={`/voyages/${v.id}`} className="text-accent hover:underline">
            <span className="font-semibold">{v.titre}</span>{" "}
            {v.destination && <span className="text-muted">· {v.destination}</span>}{" "}
            <span className="text-muted">· {t(`statuts.${v.statut}`)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
