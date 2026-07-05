"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createVoyage } from "../data/actions";
import { VOYAGE_STATUTS } from "../domain/schemas";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { Input } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

export function VoyageForm() {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(createVoyage, undefined);
  return (
    <form action={action} data-testid="voyage-form" className="flex flex-col gap-2 max-w-md">
      <Input name="titre" required placeholder={t("titre")} />
      <Input name="destination" placeholder={t("destination")} />
      <div className="flex gap-2">
        <DateField name="dateDebut" aria-label={t("dateDebut")} />
        <DateField name="dateFin" aria-label={t("dateFin")} />
      </div>
      <Select name="statut" aria-label={t("statut")} defaultValue="planifie">
        {VOYAGE_STATUTS.map((s) => <option key={s} value={s}>{t(`statuts.${s}`)}</option>)}
      </Select>
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
