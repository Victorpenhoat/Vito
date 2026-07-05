"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addRemboursement } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { Input } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

type Membre = { profile_id: string; display_name: string | null };

export function RemboursementForm({ groupeId, membres }: { groupeId: string; membres: Membre[] }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(addRemboursement, undefined);
  const nom = (m: Membre) => m.display_name ?? m.profile_id;
  return (
    <form action={action} data-testid="remboursement-form" className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="groupeId" value={groupeId} />
      {/* min-w-0 + flex-1 : les selects rétrécissent sous leur largeur intrinsèque (noms longs)
          et flex-wrap fait passer le montant à la ligne — sinon la rangée déborde du panneau
          de 320px en desktop et fait scroller toute la page horizontalement en mobile. */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select name="deProfileId" aria-label={t("de")} className="min-w-0 flex-1" defaultValue={membres[0]?.profile_id ?? ""}>
          {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
        </Select>
        <Select name="versProfileId" aria-label={t("vers")} className="min-w-0 flex-1" defaultValue={membres[1]?.profile_id ?? ""}>
          {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
        </Select>
        <Input name="montant" required inputMode="decimal" placeholder={t("montant")} className="w-28" />
      </div>
      <DateField name="date" aria-label={t("date")} />
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("remboursement")}</Button>
    </form>
  );
}
