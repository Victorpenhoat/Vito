"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { retirerResto, ajouterRestoRecherche, chercherEtablissements } from "../data/actions";

type Etab = { nom: string; ville: string | null } | { nom: string; ville: string | null }[] | null;
type Resto = { etablissement_id: string; etablissement: Etab };
type Hit = { placeId: string; nom: string; adresse: string | null };

function nom(e: Etab): string {
  const x = Array.isArray(e) ? e[0] : e;
  return x?.nom ?? "";
}

export function FamilleRestos({ restos }: { restos: Resto[] }) {
  const t = useTranslations("famille");
  const [, retirer] = useActionState(retirerResto, undefined);
  const [, ajouter] = useActionState(ajouterRestoRecherche, undefined);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {restos.length === 0 && <li>{t("vide")}</li>}
        {restos.map((r) => (
          <li key={r.etablissement_id} data-testid="famille-resto-row" className="flex items-center gap-2 border-b py-1">
            <span className="flex-1">{nom(r.etablissement)}</span>
            <form action={retirer}>
              <input type="hidden" name="etablissementId" value={r.etablissement_id} />
              <button type="submit" className="underline text-sm">{t("retirerResto")}</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={ajouter} data-testid="resto-search" className="flex flex-col gap-1">
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("rechercher")} className="border p-2 flex-1" />
          <button type="button" onClick={async () => setHits(await chercherEtablissements(query))} className="border p-2">{t("rechercherBtn")}</button>
        </div>
        <ul className="flex flex-col gap-1">
          {hits.map((h) => (
            <li key={h.placeId}><button type="button" onClick={() => setSelected(h)} className="underline text-left">{h.nom}</button></li>
          ))}
        </ul>
        {selected && <input type="hidden" name="placeId" value={selected.placeId} />}
        <button type="submit" disabled={!selected} className="bg-black text-white p-2">{t("ajouter")}{selected ? ` : ${selected.nom}` : ""}</button>
      </form>
    </div>
  );
}
