"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { retirerResto, ajouterRestoRecherche, chercherEtablissements } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";

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
      <ul className="flex flex-col gap-2">
        {restos.length === 0 && <li className="text-muted">{t("vide")}</li>}
        {restos.map((r) => (
          <li key={r.etablissement_id} data-testid="famille-resto-row" className="rounded-card border border-line bg-surface p-4 flex items-center gap-2">
            <span className="flex-1">{nom(r.etablissement)}</span>
            <form action={retirer}>
              <input type="hidden" name="etablissementId" value={r.etablissement_id} />
              <Button type="submit" variant="ghost" className="text-sm py-1 px-2">{t("retirerResto")}</Button>
            </form>
          </li>
        ))}
      </ul>
      <form action={ajouter} data-testid="resto-search" className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("rechercher")} className="flex-1" />
          <Button type="button" variant="ghost" onClick={async () => setHits(await chercherEtablissements(query))}>{t("rechercherBtn")}</Button>
        </div>
        <ul className="flex flex-col gap-1">
          {hits.map((h) => (
            <li key={h.placeId}><button type="button" onClick={() => setSelected(h)} className="text-accent hover:underline text-left">{h.nom}</button></li>
          ))}
        </ul>
        {selected && <input type="hidden" name="placeId" value={selected.placeId} />}
        <Button type="submit" disabled={!selected}>{t("ajouter")}{selected ? ` : ${selected.nom}` : ""}</Button>
      </form>
    </div>
  );
}
