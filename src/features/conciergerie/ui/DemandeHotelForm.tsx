"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { creerDemandeHotel, chercherHotels } from "../data/actions";
import { SEJOUR_TYPES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { Checkbox } from "@/features/shared/ui/Checkbox";
import { DateField } from "@/features/shared/ui/DateField";
import { Input, fieldClass } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

type Hit = { placeId: string; nom: string; adresse: string | null };

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
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("chercherHotel")} className="w-full min-w-0 flex-1" />
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
        <DateField name="dateDebut" required aria-label={t("dateDebut")} className="w-full min-w-0" />
        <Input name="nombreNuits" type="number" min={1} required placeholder={t("nuits")} className="w-full min-w-0" />
      </div>
      <Select name="sejourType" aria-label={t("sejour")} defaultValue="loisirs">
        {SEJOUR_TYPES.map((s) => <option key={s} value={s}>{t(`sejours.${s}`)}</option>)}
      </Select>
      <Checkbox name="avecEnfants" label={t("avecEnfants")} />
      <textarea name="commentaire" placeholder={t("commentaire")} className={fieldClass} />
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" disabled={!selected} pending={pending}>{t("envoyer")}</Button>
    </form>
  );
}
