import { getTranslations } from "next-intl/server";
import { ReponseForm } from "./ReponseForm";

type Etab = { nom: string; ville: string | null } | { nom: string; ville: string | null }[] | null;
type Demande = { id: string; type: string; statut: string; commentaire: string | null; etablissement: Etab };

function etabNom(e: Etab): string {
  const x = Array.isArray(e) ? e[0] : e;
  return x?.nom ?? "";
}

export async function ConciergeInbox({ demandes }: { demandes: Demande[] }) {
  const t = await getTranslations("conciergerie");
  if (demandes.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-3" data-testid="concierge-inbox">
      {demandes.map((d) => (
        <li key={d.id} data-testid="demande-row" className="border p-3">
          <p><span className="font-medium">{t(`types.${d.type}`)}</span> — {etabNom(d.etablissement)} · <span data-testid="demande-statut">{t(`statuts.${d.statut}`)}</span></p>
          {d.commentaire && <p className="text-sm text-gray-700">{d.commentaire}</p>}
          <ReponseForm demandeId={d.id} />
        </li>
      ))}
    </ul>
  );
}
