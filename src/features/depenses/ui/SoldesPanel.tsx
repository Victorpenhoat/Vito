import { getTranslations } from "next-intl/server";
import { formatCents } from "../domain/money";
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
      <h2 className="font-semibold text-ink">{t("soldes")}</h2>
      <ul className="flex flex-col gap-1">
        {soldes.map((s) => (
          <li key={s.profileId} data-testid="solde-row" className="flex items-center gap-2">
            <span className="text-ink">{nameById[s.profileId] ?? s.profileId}</span>
            <span className="text-accent font-semibold">{formatCents(s.soldeCents, devise)}</span>
          </li>
        ))}
      </ul>
      <h3 className="font-medium text-ink">{t("transferts")}</h3>
      {transferts.length === 0 ? (
        <p data-testid="solde-regle" className="text-muted">{t("regle")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {transferts.map((tr, i) => (
            <li key={i} data-testid="transfert-row" className="text-muted">
              {nameById[tr.deProfileId] ?? tr.deProfileId} {t("transfertVers")} <span className="text-accent font-semibold">{formatCents(tr.montantCents, devise)}</span> {t("vers").toLowerCase()} {nameById[tr.versProfileId] ?? tr.versProfileId}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
