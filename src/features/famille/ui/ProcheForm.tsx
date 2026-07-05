"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { ProcheDetail } from "../data/queries";
import { creerProche, modifierProche } from "../data/actions";
import { RELATIONS, CIRCLES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";
import { DeleteProcheForm } from "./DeleteProcheForm";

export function ProcheForm({ mode, initial }: { mode: "create" | "edit"; initial?: ProcheDetail }) {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(mode === "create" ? creerProche : modifierProche, undefined);
  return (
    <div className="flex max-w-md flex-col gap-4">
      <form action={action} data-testid="proche-form" className="flex flex-col gap-3">
        {mode === "edit" && <input type="hidden" name="id" value={initial!.id} />}
        <Input label={t("form.prenom")} name="first_name" required defaultValue={initial?.first_name ?? ""} />
        <Input label={t("form.nom")} name="last_name" required defaultValue={initial?.last_name ?? ""} />
        <Select label={t("form.relation")} name="relation" defaultValue={initial?.relation ?? "ami"}>
          {RELATIONS.map((r) => <option key={r} value={r}>{t(`relations.${r}`)}</option>)}
        </Select>
        <Select label={t("form.cercle")} name="circle" defaultValue={initial?.circle ?? "proche"}>
          {CIRCLES.map((c) => <option key={c} value={c}>{t(`circles.${c}`)}</option>)}
        </Select>
        <Input label={t("form.telephone")} name="phone" type="tel" defaultValue={initial?.phone ?? ""} />
        <Input label={t("form.email")} name="email" type="email" defaultValue={initial?.email ?? ""} />
        <Input label={t("form.naissance")} name="birth_date" type="date" defaultValue={initial?.birth_date ?? ""} />
        {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
        <Button type="submit" pending={pending}>{t("form.enregistrer")}</Button>
      </form>
      {mode === "edit" && (
        <DeleteProcheForm id={initial!.id} label={t("form.supprimer")} confirmMsg={t("form.confirmSuppr")} />
      )}
    </div>
  );
}
