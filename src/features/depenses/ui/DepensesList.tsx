"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteDepense } from "../data/actions";
import { formatCents } from "../domain/money";

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
        <li key={d.id} data-testid="depense-row" className="flex items-center gap-2 border-b py-1">
          <span className="flex-1">
            <span className="font-medium">{d.libelle}</span>{" "}
            {formatCents(d.montant_cents, devise)} · {t("payePar")} {nameById[d.paye_par] ?? d.paye_par}
          </span>
          <form action={action}>
            <input type="hidden" name="depenseId" value={d.id} />
            <input type="hidden" name="groupeId" value={groupeId} />
            <button type="submit" className="underline text-sm">{t("supprimer")}</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
