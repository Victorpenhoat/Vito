"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProcheDetail } from "../data/queries";
import { creerProche, modifierProche } from "../data/actions";
import { RELATIONS } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";
import { DeleteProcheForm } from "./DeleteProcheForm";

// Formulaire membre (design Onglet_Cercle, écran 4) : chips de lien de parenté,
// saisie une colonne au pouce, adresse avec héritage du foyer, CTA collé en bas.
export function ProcheForm({
  mode,
  initial,
  initialFirstName,
}: {
  mode: "create" | "edit";
  initial?: ProcheDetail;
  initialFirstName?: string;
}) {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(mode === "create" ? creerProche : modifierProche, undefined);
  const [relation, setRelation] = useState(initial?.relation ?? "ami");
  const [inherit, setInherit] = useState(initial?.address_inherit ?? false);
  return (
    <div className="flex max-w-md flex-col gap-4">
      <form action={action} data-testid="proche-form" className="flex flex-col gap-4">
        {mode === "edit" && <input type="hidden" name="id" value={initial!.id} />}

        <div className="grid grid-cols-2 gap-2.5">
          <Input label={t("form.prenom")} name="first_name" required defaultValue={initial?.first_name ?? initialFirstName ?? ""} />
          <Input label={t("form.nom")} name="last_name" required defaultValue={initial?.last_name ?? ""} />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-muted">{t("form.lienParente")}</legend>
          <div className="flex flex-wrap gap-2">
            {RELATIONS.map((r) => (
              <label key={r} className={`cursor-pointer rounded-full px-3.5 py-2 text-xs transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                relation === r ? "bg-ink font-semibold text-app" : "border border-line bg-surface text-muted hover:bg-surface-hover"
              }`}>
                <input type="radio" name="relation" value={r} checked={relation === r} onChange={() => setRelation(r)} className="sr-only" />
                {t(`relations.${r}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-2.5">
          <Input label={t("form.naissance")} name="birth_date" type="date" defaultValue={initial?.birth_date ?? ""} />
          <Input label={t("form.lieuNaissance")} name="birth_place" defaultValue={initial?.birth_place ?? ""} placeholder={t("form.optionnel")} />
        </div>
        <Input label={t("form.telephone")} name="phone" type="tel" defaultValue={initial?.phone ?? ""} placeholder={t("form.optionnel")} />
        <Input label={t("form.email")} name="email" type="email" defaultValue={initial?.email ?? ""} placeholder={t("form.optionnel")} />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">{t("form.adresse")}</span>
            {relation !== "moi" && (
              <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                inherit ? "border-accent/25 bg-accent-50 font-semibold text-accent" : "border-line bg-surface-hover text-muted"
              }`}>
                <input type="checkbox" name="address_inherit" checked={inherit} onChange={(e) => setInherit(e.target.checked)} className="sr-only" />
                {t("form.heriterFoyer")}
              </label>
            )}
          </div>
          {!(inherit && relation !== "moi") && (
            <Input name="address" defaultValue={initial?.address ?? ""} placeholder={t("form.optionnel")} aria-label={t("form.adresse")} />
          )}
        </div>

        {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}

        <div className="sticky bottom-16 -mx-4 bg-gradient-to-t from-app from-60% to-transparent px-4 pb-3 pt-6 md:bottom-0">
          <Button type="submit" pending={pending} className="w-full py-3.5 shadow-[0_6px_18px_rgba(37,99,235,.3)]">
            {t("form.enregistrer")}
          </Button>
        </div>
      </form>
      {mode === "edit" && (
        <DeleteProcheForm id={initial!.id} label={t("form.supprimer")} confirmMsg={t("form.confirmSuppr")} />
      )}
    </div>
  );
}
