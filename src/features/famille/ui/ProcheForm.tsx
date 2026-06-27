"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { ProcheDetail } from "../data/queries";
import { creerProche, modifierProche } from "../data/actions";
import { RELATIONS, CIRCLES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { DeleteProcheForm } from "./DeleteProcheForm";

const FIELD = "rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent";

export function ProcheForm({ mode, initial }: { mode: "create" | "edit"; initial?: ProcheDetail }) {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(mode === "create" ? creerProche : modifierProche, undefined);
  return (
    <div className="flex max-w-md flex-col gap-4">
      <form action={action} data-testid="proche-form" className="flex flex-col gap-3">
        {mode === "edit" && <input type="hidden" name="id" value={initial!.id} />}
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.prenom")}</span>
          <input name="first_name" required defaultValue={initial?.first_name ?? ""} className={FIELD} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.nom")}</span>
          <input name="last_name" required defaultValue={initial?.last_name ?? ""} className={FIELD} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.relation")}</span>
          <select name="relation" defaultValue={initial?.relation ?? "ami"} className={FIELD}>
            {RELATIONS.map((r) => <option key={r} value={r}>{t(`relations.${r}`)}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.cercle")}</span>
          <select name="circle" defaultValue={initial?.circle ?? "proche"} className={FIELD}>
            {CIRCLES.map((c) => <option key={c} value={c}>{t(`circles.${c}`)}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.telephone")}</span>
          <input name="phone" type="tel" defaultValue={initial?.phone ?? ""} className={FIELD} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.email")}</span>
          <input name="email" type="email" defaultValue={initial?.email ?? ""} className={FIELD} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.naissance")}</span>
          <input name="birth_date" type="date" defaultValue={initial?.birth_date ?? ""} className={FIELD} /></label>
        {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
        <Button type="submit" pending={pending}>{t("form.enregistrer")}</Button>
      </form>
      {mode === "edit" && (
        <DeleteProcheForm id={initial!.id} label={t("form.supprimer")} confirmMsg={t("form.confirmSuppr")} />
      )}
    </div>
  );
}
