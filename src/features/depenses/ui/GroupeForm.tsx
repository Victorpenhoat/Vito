"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createGroupe } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

type VoyageOption = { id: string; titre: string };

export function GroupeForm({ voyages }: { voyages: VoyageOption[] }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(createGroupe, undefined);
  return (
    <form action={action} data-testid="groupe-form" className="flex flex-col gap-2 max-w-md">
      <input name="titre" required placeholder={t("titre")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <input name="devise" defaultValue="EUR" maxLength={3} aria-label={t("devise")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <select name="voyageId" aria-label={t("voyageLie")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" defaultValue="">
        <option value="">{t("aucunVoyage")}</option>
        {voyages.map((v) => <option key={v.id} value={v.id}>{v.titre}</option>)}
      </select>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("create")}</Button>
    </form>
  );
}
