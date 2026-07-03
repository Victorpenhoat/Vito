"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addRemboursement } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

type Membre = { profile_id: string; display_name: string | null };

export function RemboursementForm({ groupeId, membres }: { groupeId: string; membres: Membre[] }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(addRemboursement, undefined);
  const nom = (m: Membre) => m.display_name ?? m.profile_id;
  const inputCls = "rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent";
  return (
    <form action={action} data-testid="remboursement-form" className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="groupeId" value={groupeId} />
      {/* min-w-0 + flex-1 : les selects rétrécissent sous leur largeur intrinsèque (noms longs)
          et flex-wrap fait passer le montant à la ligne — sinon la rangée déborde du panneau
          de 320px en desktop et fait scroller toute la page horizontalement en mobile. */}
      <div className="flex flex-wrap gap-2 items-center">
        <select name="deProfileId" aria-label={t("de")} className={`${inputCls} min-w-0 flex-1`} defaultValue={membres[0]?.profile_id ?? ""}>
          {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
        </select>
        <select name="versProfileId" aria-label={t("vers")} className={`${inputCls} min-w-0 flex-1`} defaultValue={membres[1]?.profile_id ?? ""}>
          {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
        </select>
        <input name="montant" required inputMode="decimal" placeholder={t("montant")} className={`${inputCls} w-28`} />
      </div>
      <input name="date" type="date" aria-label={t("date")} className={inputCls} />
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("remboursement")}</Button>
    </form>
  );
}
