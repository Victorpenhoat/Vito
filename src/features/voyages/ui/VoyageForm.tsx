"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createVoyage } from "../data/actions";
import { VOYAGE_STATUTS } from "../domain/schemas";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";

export function VoyageForm() {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(createVoyage, undefined);
  return (
    <form action={action} data-testid="voyage-form" className="flex flex-col gap-2 max-w-md">
      <input name="titre" required placeholder={t("titre")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <input name="destination" placeholder={t("destination")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <div className="flex gap-2">
        <input name="dateDebut" type="date" aria-label={t("dateDebut")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
        <input name="dateFin" type="date" aria-label={t("dateFin")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      </div>
      <select name="statut" aria-label={t("statut")} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" defaultValue="planifie">
        {VOYAGE_STATUTS.map((s) => <option key={s} value={s}>{t(`statuts.${s}`)}</option>)}
      </select>
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      {state && "limit" in state && state.limit && (
        <p data-testid="voyage-limit-cta">
          <Link href="/abonnement" className="text-accent hover:underline">{t("limitCta")}</Link>
        </p>
      )}
      <Button type="submit" pending={pending}>{t("create")}</Button>
    </form>
  );
}
