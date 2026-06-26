import { getTranslations } from "next-intl/server";
import { formatCents } from "../domain/money";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import type { Balance, Transfert } from "../domain/calculations";

export async function SoldesPanel({ soldes, transferts, devise, nameById }: {
  soldes: Balance[];
  transferts: Transfert[];
  devise: string;
  nameById: Record<string, string>;
}) {
  const t = await getTranslations("depenses");
  return (
    <section data-testid="soldes-panel" className="flex flex-col gap-2">
      <SectionLabel>{t("equilibre")}</SectionLabel>
      <ul className="flex flex-col">
        {soldes.map((s) => (
          <li key={s.profileId} data-testid="solde-row" className="flex items-center justify-between border-b border-line-soft py-2 text-sm">
            <span className="text-ink">{nameById[s.profileId] ?? s.profileId}</span>
            <span className={`font-semibold ${s.soldeCents >= 0 ? "text-kpi-green" : "text-kpi-amber"}`}>{formatCents(s.soldeCents, devise)}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{t("transferts")}</h3>
      {transferts.length === 0 ? (
        <p data-testid="solde-regle" className="text-sm text-muted">{t("regle")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {transferts.map((tr, i) => (
            <li key={i} data-testid="transfert-row" className="text-sm text-muted">
              {nameById[tr.deProfileId] ?? tr.deProfileId} {t("transfertVers")} <span className="font-semibold text-ink">{formatCents(tr.montantCents, devise)}</span> {t("vers").toLowerCase()} {nameById[tr.versProfileId] ?? tr.versProfileId}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
