"use client";
import { useActionState, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";
import { ajouterPaiement, reglerPaiement } from "../data/actions";
import { etatEcheance, ordonnerEcheances, totalRegle, type Paiement } from "../domain/fiche";

const TEINTE: Record<string, string> = {
  paye: "border-kpi-green/30 bg-kpi-green-bg text-kpi-green",
  en_retard: "border-danger/30 bg-danger-bg text-danger",
  a_venir: "border-line bg-surface-hover text-muted",
};

type PaiementAffiche = Paiement & { libelle: string; devise: string };

/**
 * Le coût : ce qui est réglé, ce qui est dû, et le geste d'un clic pour dire
 * qu'on vient de payer.
 *
 * L'état « en retard » n'est jamais stocké — il se déduit de l'échéance à
 * chaque affichage. Un statut figé serait faux le lendemain.
 */
export function SectionCout({ activiteId, paiements, aujourdhui }: {
  activiteId: string; paiements: PaiementAffiche[]; aujourdhui: string;
}) {
  const t = useTranslations("activites");
  const format = useFormatter();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);

  const [ajout, actionAjout, enAjout] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const res = await ajouterPaiement(prev, fd);
      if ("ok" in res && res.ok) { setOuvert(false); router.refresh(); }
      return res;
    },
    undefined,
  );
  const [reglement, actionRegler, enReglement] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const res = await reglerPaiement(prev, fd);
      if ("ok" in res && res.ok) router.refresh();
      return res;
    },
    undefined,
  );

  const euros = (cents: number, devise: string) =>
    format.number(cents / 100, { style: "currency", currency: devise, maximumFractionDigits: 2 });
  const dateCourte = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const champ = "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent";

  return (
    <section data-testid="section-cout" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("sections.cout")}</h2>

      {paiements.length === 0 ? (
        <p className="text-[12.5px] text-muted">{t("cout.aucun")}</p>
      ) : (
        <>
          <p className="text-[13px] text-muted">
            {t("cout.regle")}{" "}
            <span data-testid="cout-regle" className="font-serif text-lg text-ink">
              {euros(totalRegle(paiements), paiements[0]!.devise)}
            </span>
          </p>
          <ul className="flex flex-col">
            {ordonnerEcheances(paiements, aujourdhui).map((p) => {
              const etat = etatEcheance(p, aujourdhui);
              return (
                <li key={p.id} data-testid="fiche-echeance" className="flex flex-wrap items-center gap-2 border-b border-line-soft py-2 last:border-b-0">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.libelle}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${TEINTE[etat]}`}>
                    {t(`cout.etats.${etat}`)}
                  </span>
                  {p.echeance && <span className="shrink-0 text-[11.5px] text-muted">{dateCourte(p.echeance)}</span>}
                  <span className="shrink-0 text-[13px] tabular-nums text-ink">{euros(p.montantCents, p.devise)}</span>
                  <form action={actionRegler} className="shrink-0">
                    <input type="hidden" name="paiementId" value={p.id} />
                    <input type="hidden" name="activiteId" value={activiteId} />
                    <input type="hidden" name="paye" value={p.statut === "paye" ? "non" : "oui"} />
                    <button type="submit" disabled={enReglement}
                      data-testid={p.statut === "paye" ? "echeance-defaire" : "echeance-regler"}
                      className="text-[11.5px] font-semibold text-accent hover:underline disabled:opacity-50">
                      {t(p.statut === "paye" ? "cout.defaire" : "cout.marquerRegle")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          {reglement && "error" in reglement && reglement.error && (
            <p role="alert" className="text-[12px] text-danger">{reglement.error}</p>
          )}
        </>
      )}

      {!ouvert ? (
        <button type="button" data-testid="paiement-ajouter" onClick={() => setOuvert(true)}
          className="self-start text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
          + {t("cout.ajouter")}
        </button>
      ) : (
        <form action={actionAjout} data-testid="paiement-form" className="flex flex-col gap-2 rounded-control border border-line bg-surface-hover p-3">
          <input type="hidden" name="activiteId" value={activiteId} />
          <input name="libelle" data-testid="paiement-libelle" placeholder={t("cout.libelle")} aria-label={t("cout.libelle")} className={champ} />
          <div className="flex flex-wrap gap-2">
            <input name="montant" data-testid="paiement-montant" inputMode="decimal"
              placeholder={t("cout.montant")} aria-label={t("cout.montant")} className={`${champ} w-28`} />
            <input type="date" name="echeance" data-testid="paiement-echeance"
              aria-label={t("cout.echeance")} className={`${champ} min-w-0 flex-1`} />
          </div>
          <select name="periodicite" data-testid="paiement-periodicite" aria-label={t("cout.periodicite")} defaultValue="" className={champ}>
            <option value="">{t("cout.sansPeriodicite")}</option>
            {(["unique", "mensuelle", "trimestrielle", "annuelle"] as const).map((p) => (
              <option key={p} value={p}>{t(`cout.periodicites.${p}`)}</option>
            ))}
          </select>
          {ajout && "error" in ajout && ajout.error && (
            <p role="alert" className="text-[12px] text-danger">{ajout.error}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" pending={enAjout} data-testid="paiement-valider">{t("cout.enregistrer")}</Button>
            <button type="button" onClick={() => setOuvert(false)} className="text-[12.5px] text-muted hover:text-ink">
              {t("annuler")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
