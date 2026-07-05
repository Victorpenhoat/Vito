"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { addDepense } from "../data/actions";
import { DEPENSE_MODES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { Checkbox } from "@/features/shared/ui/Checkbox";
import { DateField } from "@/features/shared/ui/DateField";
import { Input } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

type Membre = { profile_id: string; display_name: string | null };

export function DepenseForm({ groupeId, membres }: { groupeId: string; membres: Membre[] }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(addDepense, undefined);
  const [mode, setMode] = useState<"egal" | "exact">("egal");
  const nom = (m: Membre) => m.display_name ?? m.profile_id;
  return (
    <form action={action} data-testid="depense-form" className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="groupeId" value={groupeId} />
      <Input name="libelle" required placeholder={t("libelle")} />
      <Input name="montant" required inputMode="decimal" placeholder={t("montant")} />
      <Select name="payePar" aria-label={t("payePar")} defaultValue={membres[0]?.profile_id ?? ""}>
        {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
      </Select>
      <DateField name="date" aria-label={t("date")} />
      <Select name="mode" aria-label={t("mode")} value={mode} onChange={(e) => setMode(e.target.value as "egal" | "exact")}>
        {DEPENSE_MODES.map((m) => <option key={m} value={m}>{t(`modes.${m}`)}</option>)}
      </Select>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-ink">{t("participants")}</legend>
        {membres.map((m) => (
          <Checkbox
            key={m.profile_id}
            name="participants"
            value={m.profile_id}
            defaultChecked
            className="w-full"
            label={<>
              <span className="flex-1 text-ink">{nom(m)}</span>
              {mode === "exact" && (
                <Input name={`exact:${m.profile_id}`} inputMode="decimal" placeholder={t("montant")} className="w-24" />
              )}
            </>}
          />
        ))}
      </fieldset>
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("addDepense")}</Button>
    </form>
  );
}
