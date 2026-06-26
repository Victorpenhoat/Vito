import { getTranslations } from "next-intl/server";
import { dureeFromNuits } from "../domain/duree";

type Etab = { nom: string; ville: string | null } | { nom: string; ville: string | null }[] | null;
type Demande = {
  id: string; type: string; statut: string; reponse: string | null;
  date_debut: string | null; nombre_nuits: number | null; commentaire: string | null;
  etablissement: Etab;
};

function etabNom(e: Etab): string {
  const x = Array.isArray(e) ? e[0] : e;
  return x?.nom ?? "";
}

const STATUT_CLASS: Record<string, string> = {
  nouvelle: "bg-kpi-blue-bg text-kpi-blue",
  en_cours: "bg-kpi-amber-bg text-kpi-amber",
  confirmee: "bg-kpi-green-bg text-kpi-green",
  refusee: "bg-badge text-muted",
};

export async function DemandesList({ demandes }: { demandes: Demande[] }) {
  const t = await getTranslations("conciergerie");
  if (demandes.length === 0) return <p className="text-sm text-muted">{t("vide")}</p>;
  return (
    <ul className="flex flex-col">
      {demandes.map((d) => (
        <li key={d.id} data-testid="demande-row" className="flex flex-col gap-1 border-b border-line-soft py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-serif text-lg text-ink">{t(`types.${d.type}`)}{etabNom(d.etablissement) ? ` · ${etabNom(d.etablissement)}` : ""}</span>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${STATUT_CLASS[d.statut] ?? "bg-badge text-muted"}`}>
              <span data-testid="demande-statut">{t(`statuts.${d.statut}`)}</span>
            </span>
          </div>
          {d.type === "hotel" && d.date_debut && d.nombre_nuits !== null && (
            <span className="text-sm text-muted">{d.date_debut} → {dureeFromNuits(d.date_debut, d.nombre_nuits)}</span>
          )}
          {d.commentaire && <p className="text-sm text-muted">{d.commentaire}</p>}
          {d.reponse && <p className="text-sm text-muted">{t("reponse")} : {d.reponse}</p>}
        </li>
      ))}
    </ul>
  );
}
