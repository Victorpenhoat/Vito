import { getTranslations } from "next-intl/server";
import { rechercheRestos } from "../data/queries";
import { rechercheCriteriaSchema } from "../domain/schemas";
import { Link } from "@/lib/i18n/routing";

export async function RechercheResults({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = await getTranslations("recherche");
  const criteria = rechercheCriteriaSchema.parse({
    zone: searchParams.zone, budgetMax: searchParams.budgetMax, type: searchParams.type, ambiance: searchParams.ambiance,
  });
  const { maListe, recos } = await rechercheRestos(criteria);
  const row = (e: { id: string; nom: string; type: string | null; arrondissement: string | null }) => (
    <li key={e.id} data-testid="resto-result" className="rounded-card border border-line bg-surface p-4">
      <Link href={`/restos/${e.id}`} className="text-accent hover:underline">{e.nom} <span className="text-muted">{e.type ?? ""} {e.arrondissement ?? ""}</span></Link>
    </li>
  );
  return (
    <div className="flex flex-col gap-6">
      <section data-testid="ma-liste-section">
        <h2 className="font-semibold">{t("maListe")}</h2>
        {maListe.length === 0 ? <p>{t("vide")}</p> : <ul className="flex flex-col gap-2">{maListe.map(row)}</ul>}
      </section>
      <section data-testid="recos-section">
        <h2 className="font-semibold">{t("recos")}</h2>
        {recos.length === 0 ? <p>{t("vide")}</p> : <ul className="flex flex-col gap-2">{recos.map(row)}</ul>}
      </section>
    </div>
  );
}
