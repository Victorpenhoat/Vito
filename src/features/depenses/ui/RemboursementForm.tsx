"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addRemboursement } from "../data/actions";

type Membre = { profile_id: string; display_name: string | null };

export function RemboursementForm({ groupeId, membres }: { groupeId: string; membres: Membre[] }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(addRemboursement, undefined);
  const nom = (m: Membre) => m.display_name ?? m.profile_id;
  return (
    <form action={action} data-testid="remboursement-form" className="flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="groupeId" value={groupeId} />
      <div className="flex gap-2 items-center">
        <select name="deProfileId" aria-label={t("de")} className="border p-2" defaultValue={membres[0]?.profile_id ?? ""}>
          {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
        </select>
        <select name="versProfileId" aria-label={t("vers")} className="border p-2" defaultValue={membres[1]?.profile_id ?? ""}>
          {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
        </select>
        <input name="montant" required inputMode="decimal" placeholder={t("montant")} className="border p-2 w-28" />
      </div>
      <input name="date" type="date" aria-label={t("date")} className="border p-2" />
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("remboursement")}</button>
    </form>
  );
}
