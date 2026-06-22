"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { creerDemandeHotel, chercherHotels } from "../data/actions";
import { SEJOUR_TYPES } from "../domain/schemas";

type Hit = { placeId: string; nom: string; adresse: string | null };

export function DemandeHotelForm() {
  const t = useTranslations("conciergerie");
  const [state, action, pending] = useActionState(creerDemandeHotel, undefined);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  return (
    <form action={action} data-testid="demande-hotel-form" className="flex flex-col gap-2 max-w-md border-t pt-3">
      <div data-testid="hotel-search" className="flex flex-col gap-1">
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("chercherHotel")} className="border p-2 flex-1" />
          <button type="button" onClick={async () => setHits(await chercherHotels(query))} className="border p-2">{t("rechercher")}</button>
        </div>
        <ul className="flex flex-col gap-1">
          {hits.map((h) => (
            <li key={h.placeId}>
              <button type="button" onClick={() => setSelected(h)} className="underline text-left">{h.nom}</button>
            </li>
          ))}
        </ul>
        {selected && <p className="text-sm">{t("selectionne")} : {selected.nom}</p>}
        {selected && <input type="hidden" name="placeId" value={selected.placeId} />}
      </div>
      <div className="flex gap-2">
        <input name="dateDebut" type="date" required aria-label={t("dateDebut")} className="border p-2" />
        <input name="nombreNuits" type="number" min={1} required placeholder={t("nuits")} className="border p-2" />
      </div>
      <select name="sejourType" aria-label={t("sejour")} className="border p-2" defaultValue="loisirs">
        {SEJOUR_TYPES.map((s) => <option key={s} value={s}>{t(`sejours.${s}`)}</option>)}
      </select>
      <label className="flex items-center gap-2"><input type="checkbox" name="avecEnfants" /> {t("avecEnfants")}</label>
      <textarea name="commentaire" placeholder={t("commentaire")} className="border p-2" />
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending || !selected} className="bg-black text-white p-2">{t("envoyer")}</button>
    </form>
  );
}
