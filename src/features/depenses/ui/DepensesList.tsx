"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { deleteDepense } from "../data/actions";
import { formatCents } from "../domain/money";
import { formatDay } from "@/lib/format/date";
import { Button } from "@/features/shared/ui/Button";

type Depense = { id: string; paye_par: string; libelle: string; montant_cents: number; date: string | null; mode: string };

export function DepensesList({ groupeId, depenses, devise, nameById }: {
  groupeId: string;
  depenses: Depense[];
  devise: string;
  nameById: Record<string, string>;
}) {
  const t = useTranslations("depenses");
  const locale = useLocale();
  const [, action] = useActionState(deleteDepense, undefined);
  return (
    <ul className="flex flex-col">
      {depenses.map((d) => (
        <li key={d.id} data-testid="depense-row" className="flex items-center justify-between gap-3 border-b border-line-soft py-3">
          <div className="min-w-0">
            <div className="text-ink">{d.libelle}</div>
            <div className="text-xs text-muted">{t("payePar")} {nameById[d.paye_par] ?? d.paye_par}{d.date ? ` · ${formatDay(d.date, locale)}` : ""}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-serif text-lg text-ink">{formatCents(d.montant_cents, devise)}</span>
            <form action={action}>
              <input type="hidden" name="depenseId" value={d.id} />
              <input type="hidden" name="groupeId" value={groupeId} />
              <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">{t("supprimer")}</Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
