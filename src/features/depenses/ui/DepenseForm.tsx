"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { addDepense } from "../data/actions";
import { DEPENSE_MODES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";

type Membre = { profile_id: string; display_name: string | null };

export function DepenseForm({ groupeId, membres }: { groupeId: string; membres: Membre[] }) {
  const t = useTranslations("depenses");
  const [state, action, pending] = useActionState(addDepense, undefined);
  const [mode, setMode] = useState<"egal" | "exact">("egal");
  const nom = (m: Membre) => m.display_name ?? m.profile_id;
  const inputCls = "rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent";
  return (
    <form action={action} data-testid="depense-form" className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="groupeId" value={groupeId} />
      <input name="libelle" required placeholder={t("libelle")} className={inputCls} />
      <input name="montant" required inputMode="decimal" placeholder={t("montant")} className={inputCls} />
      <select name="payePar" aria-label={t("payePar")} className={inputCls} defaultValue={membres[0]?.profile_id ?? ""}>
        {membres.map((m) => <option key={m.profile_id} value={m.profile_id}>{nom(m)}</option>)}
      </select>
      <input name="date" type="date" aria-label={t("date")} className={inputCls} />
      <select name="mode" aria-label={t("mode")} className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as "egal" | "exact")}>
        {DEPENSE_MODES.map((m) => <option key={m} value={m}>{t(`modes.${m}`)}</option>)}
      </select>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-ink">{t("participants")}</legend>
        {membres.map((m) => (
          <label key={m.profile_id} className="flex items-center gap-2">
            <input type="checkbox" name="participants" value={m.profile_id} defaultChecked />
            <span className="flex-1 text-ink">{nom(m)}</span>
            {mode === "exact" && (
              <input name={`exact:${m.profile_id}`} inputMode="decimal" placeholder={t("montant")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent w-24" />
            )}
          </label>
        ))}
      </fieldset>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("addDepense")}</Button>
    </form>
  );
}
