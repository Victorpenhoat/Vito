"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { shareVoyage } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";

export function ShareForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(shareVoyage, undefined);
  return (
    <form action={action} data-testid="share-form" className="flex gap-2 items-center">
      <input type="hidden" name="voyageId" value={voyageId} />
      <Input name="email" type="email" required placeholder={t("partagerEmail")} className="flex-1" />
      <Button type="submit" pending={pending}>{t("partager")}</Button>
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
    </form>
  );
}
