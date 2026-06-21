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
      <h2 className="font-semibold">{t("soldes")}</h2>
      <ul className="flex flex-col gap-1">
        {soldes.map((s) => (
          <li key={s.profileId} data-testid="solde-row">
            {nameById[s.profileId] ?? s.profileId} : {formatCents(s.soldeCents, devise)}
          </li>
        ))}
      </ul>
      <h3 className="font-medium">{t("transferts")}</h3>
      {transferts.length === 0 ? (
        <p data-testid="solde-regle">{t("regle")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {transferts.map((tr, i) => (
            <li key={i} data-testid="transfert-row">
              {nameById[tr.deProfileId] ?? tr.deProfileId} {t("transfertVers")} {formatCents(tr.montantCents, devise)} {t("vers").toLowerCase()} {nameById[tr.versProfileId] ?? tr.versProfileId}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
