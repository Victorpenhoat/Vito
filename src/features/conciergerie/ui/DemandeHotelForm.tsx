"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { creerDemandeHotel, chercherHotels } from "../data/actions";
import { SEJOUR_TYPES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";

type Hit = { placeId: string; nom: string; adresse: string | null };

const inputCls = "w-full min-w-0 rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent";

export function DemandeHotelForm() {
  const t = useTranslations("conciergerie");
  const [state, action, pending] = useActionState(creerDemandeHotel, undefined);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  return (
    <form action={action} data-testid="demande-hotel-form" className="flex flex-col gap-2">
      <div data-testid="hotel-search" className="flex flex-col gap-1">
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("chercherHotel")} className={`${inputCls} flex-1`} />
          <Button type="button" variant="ghost" onClick={async () => setHits(await chercherHotels(query))}>{t("rechercher")}</Button>
        </div>
        <ul className="flex flex-col gap-1">
          {hits.map((h) => (
            <li key={h.placeId}>
              <button type="button" onClick={() => setSelected(h)} className="text-accent hover:underline text-left">{h.nom}</button>
            </li>
          ))}
        </ul>
        {selected && <p className="text-sm">{t("selectionne")} : {selected.nom}</p>}
        {selected && <input type="hidden" name="placeId" value={selected.placeId} />}
      </div>
      <div className="flex flex-col gap-2">
        <input name="dateDebut" type="date" required aria-label={t("dateDebut")} className={inputCls} />
        <input name="nombreNuits" type="number" min={1} required placeholder={t("nuits")} className={inputCls} />
      </div>
      <select name="sejourType" aria-label={t("sejour")} className={inputCls} defaultValue="loisirs">
        {SEJOUR_TYPES.map((s) => <option key={s} value={s}>{t(`sejours.${s}`)}</option>)}
      </select>
      <label className="flex items-center gap-2"><input type="checkbox" name="avecEnfants" /> {t("avecEnfants")}</label>
      <textarea name="commentaire" placeholder={t("commentaire")} className={inputCls} />
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" disabled={!selected} pending={pending}>{t("envoyer")}</Button>
    </form>
  );
}
