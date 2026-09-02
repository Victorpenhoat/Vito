"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createVoyage, updateVoyage } from "../data/actions";
import { VOYAGE_STATUTS_FORM } from "../domain/schemas";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { Input } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

export type VoyageInitial = {
  id: string;
  titre: string;
  destination: string | null;
  date_debut: string | null;
  date_fin: string | null;
  statut: string;
  periode_texte: string | null;
  cover_url: string | null;
  cover_photo_ref: string | null;
};

export function VoyageForm({ mode = "create", initial }: { mode?: "create" | "edit"; initial?: VoyageInitial }) {
  const t = useTranslations("voyages");
  // updateVoyage retourne un sous-ensemble de createVoyage (pas de `limit`) :
  // l'alignement de signature évite que useActionState infère `unknown` sur l'union.
  const [state, action, pending] = useActionState(
    mode === "create" ? createVoyage : (updateVoyage as typeof createVoyage),
    undefined,
  );
  const [statut, setStatut] = useState(initial?.statut ?? "en_preparation");
  // statuts legacy (planifie, en_cours) : conservés dans le select en édition seulement
  const options: string[] = (VOYAGE_STATUTS_FORM as readonly string[]).includes(statut)
    ? [...VOYAGE_STATUTS_FORM]
    : [statut, ...VOYAGE_STATUTS_FORM];
  return (
    <form action={action} data-testid="voyage-form" className="flex max-w-md flex-col gap-2.5">
      {mode === "edit" && <input type="hidden" name="voyageId" value={initial!.id} />}
      {mode === "edit" && initial?.cover_photo_ref && <input type="hidden" name="coverPhotoRef" value={initial.cover_photo_ref} />}
      <Input name="titre" required placeholder={t("titre")} defaultValue={initial?.titre ?? ""} aria-label={t("titre")} />
      <Input name="destination" placeholder={t("destination")} defaultValue={initial?.destination ?? ""} aria-label={t("destination")} />
      <Select name="statut" aria-label={t("statut")} value={statut} onChange={(e) => setStatut(e.target.value)}>
        {options.map((s) => <option key={s} value={s}>{t(`statuts.${s}`)}</option>)}
      </Select>
      {statut === "idee" ? (
        <Input name="periodeTexte" placeholder={t("periodeTexte")} defaultValue={initial?.periode_texte ?? ""} aria-label={t("periodeTexte")} />
      ) : (
        <div className="flex gap-2">
          <DateField name="dateDebut" aria-label={t("dateDebut")} defaultValue={initial?.date_debut ?? ""} />
          <DateField name="dateFin" aria-label={t("dateFin")} defaultValue={initial?.date_fin ?? ""} />
        </div>
      )}
      <Input name="coverUrl" type="url" placeholder={t("coverUrl")} defaultValue={initial?.cover_url ?? ""} aria-label={t("coverUrl")} />
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      {state && "limit" in state && state.limit && (
        <p data-testid="voyage-limit-cta">
          <Link href="/abonnement" className="text-accent hover:underline">{t("limitCta")}</Link>
        </p>
      )}
      <Button type="submit" pending={pending}>{mode === "create" ? t("create") : t("save")}</Button>
    </form>
  );
}
