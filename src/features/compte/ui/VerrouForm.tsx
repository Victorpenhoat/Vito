"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setPreferencesVerrou } from "../data/actions";
import { DELAIS_VERROU } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";

// Réglages > Sécurité : délai de verrouillage (design Onboarding écran 6).
export function VerrouForm({ delaiMinutes }: { delaiMinutes: number }) {
  const t = useTranslations("compte");
  const [state, action, pending] = useActionState(setPreferencesVerrou, undefined);

  return (
    <form action={action} data-testid="verrou-form" className="flex flex-col gap-3 rounded-[5px] border border-line bg-surface px-3.5 py-3">
      <div>
        <div className="text-[13.5px] text-ink">{t("verrou.titre")}</div>
        <p className="mt-0.5 text-[11.5px] text-muted">{t("verrou.explication")}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DELAIS_VERROU.map((d) => (
          <label key={d} className="cursor-pointer">
            <input type="radio" name="delaiMinutes" value={d} defaultChecked={d === delaiMinutes}
              className="peer sr-only" data-testid={`verrou-delai-${d}`} />
            <span className="inline-block rounded-full border border-line bg-surface-hover px-3 py-1.5 text-[11.5px] text-muted peer-checked:border-accent/25 peer-checked:bg-accent-50 peer-checked:font-semibold peer-checked:text-accent">
              {d === 0 ? t("verrou.immediat") : t("verrou.minutes", { n: d })}
            </span>
          </label>
        ))}
      </div>
      {state && "error" in state && state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state && "ok" in state && state.ok && (
        <p data-testid="verrou-enregistre" className="text-[12px] text-kpi-green">{t("verrou.enregistre")}</p>
      )}
      <Button type="submit" pending={pending} className="self-start py-2 text-xs">{t("profil.enregistrer")}</Button>
    </form>
  );
}
