"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createGroupe } from "../data/actions";

type VoyageOption = { id: string; titre: string };

export function GroupeForm({ voyages }: { voyages: VoyageOption[] }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(createGroupe, undefined);
  return (
    <form action={action} data-testid="groupe-form" className="flex flex-col gap-2 max-w-md">
      <input name="titre" required placeholder={t("titre")} className="border p-2" />
      <input name="devise" defaultValue="EUR" maxLength={3} aria-label={t("devise")} className="border p-2" />
      <select name="voyageId" aria-label={t("voyageLie")} className="border p-2" defaultValue="">
        <option value="">{t("aucunVoyage")}</option>
        {voyages.map((v) => <option key={v.id} value={v.id}>{v.titre}</option>)}
      </select>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("create")}</button>
    </form>
  );
}
