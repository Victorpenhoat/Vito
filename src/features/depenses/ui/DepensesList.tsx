"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteDepense } from "../data/actions";
import { formatCents } from "../domain/money";
import { Button } from "@/features/shared/ui/Button";

type Depense = { id: string; paye_par: string; libelle: string; montant_cents: number; date: string | null; mode: string };

export function DepensesList({ groupeId, depenses, devise, nameById }: {
  groupeId: string;
  depenses: Depense[];
  devise: string;
  nameById: Record<string, string>;
}) {
  const t = useTranslations("depenses");
  const [, action] = useActionState(deleteDepense, undefined);
  return (
    <ul className="flex flex-col gap-1">
      {depenses.map((d) => (
        <li key={d.id} data-testid="depense-row" className="flex items-center gap-2 border-b border-line py-2">
          <span className="flex-1">
            <span className="font-medium text-ink">{d.libelle}</span>{" "}
            <span className="text-accent font-semibold">{formatCents(d.montant_cents, devise)}</span>
            <span className="text-muted"> · {t("payePar")} {nameById[d.paye_par] ?? d.paye_par}</span>
          </span>
          <form action={action}>
            <input type="hidden" name="depenseId" value={d.id} />
            <input type="hidden" name="groupeId" value={groupeId} />
            <Button type="submit" variant="ghost" className="text-sm px-2 py-1">{t("supprimer")}</Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
