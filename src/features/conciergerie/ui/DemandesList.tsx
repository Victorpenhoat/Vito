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

export async function DemandesList({ demandes }: { demandes: Demande[] }) {
  const t = await getTranslations("conciergerie");
  if (demandes.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {demandes.map((d) => (
        <li key={d.id} data-testid="demande-row" className="border p-3">
          <span className="font-medium">{t(`types.${d.type}`)}</span> — {etabNom(d.etablissement)}{" "}
          · <span data-testid="demande-statut">{t(`statuts.${d.statut}`)}</span>
          {d.type === "hotel" && d.date_debut && d.nombre_nuits !== null && (
            <span className="text-sm text-gray-600"> · {d.date_debut} → {dureeFromNuits(d.date_debut, d.nombre_nuits)}</span>
          )}
          {d.commentaire && <p className="text-sm text-gray-700">{d.commentaire}</p>}
          {d.reponse && <p className="text-sm text-gray-700">{t("reponse")} : {d.reponse}</p>}
        </li>
      ))}
    </ul>
  );
}
