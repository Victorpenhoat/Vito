import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { formatDay } from "@/lib/format/date";
import { getVinFiche } from "../data/queries";
import { getMerchantProvider } from "@/lib/services/merchant";
import { couleurTint } from "../domain/couleurTint";
import { AXES_PROFIL, niveauProfil, remplissageProfil } from "../domain/analyse";
import { BuyButton } from "./BuyButton";
import { VerresLecture } from "./NoteVerres";
import { CorrigerButton, type CorrectionVin } from "./CorrectionAnalyse";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

// Fiche vin (design Vins & Cave écran 4). Deux natures d'information cohabitent
// et ne doivent JAMAIS se confondre : ce qui est GÉNÉRÉ à partir de l'étiquette
// (profil, arômes, accords, présentation — annoncé comme tel, corrigeable) et
// ce que j'ai VÉCU (mes dégustations, saisies par moi).
export async function VinFiche({ id }: { id: string }) {
  const t = await getTranslations("vins");
  const locale = await getLocale();
  const fiche = await getVinFiche(id);
  if (!fiche) notFound();
  const { vin, analyse, degustations, noteMoyenne } = fiche;

  const merchantUrl = getMerchantProvider().buyUrl(
    { nom: vin.nom, domaine: vin.domaine, millesime: vin.millesime, couleur: vin.couleur },
    1,
  );
  const titre = vin.domaine ?? vin.nom;
  const sousTitre = [
    [vin.appellation ?? vin.region, vin.millesime].filter(Boolean).join(" "),
    vin.couleur ? t(`couleurs.${vin.couleur}`) : null,
    vin.cepages?.length ? vin.cepages.join(", ") : null,
  ].filter(Boolean).join(" · ");
  const prixPaye = degustations.find((d) => d.prix_paye != null);
  // Ce que la correction peut toucher — assemblé une fois, partagé par tous les
  // blocs générés (chacun porte son bouton « Corriger », design écran 4).
  const correction: CorrectionVin = {
    id: vin.id, domaine: vin.domaine, cuvee: vin.cuvee, appellation: vin.appellation,
    region: vin.region, millesime: vin.millesime, degre: vin.degre,
    couleur: vin.couleur, cepages: vin.cepages ?? [],
  };

  return (
    <article className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-card">
        <div className="h-40 md:h-52" style={{ background: couleurTint(vin.couleur) }} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 text-white">
          <h1 className="font-serif text-3xl font-medium md:text-4xl">{titre}</h1>
          {vin.cuvee && <div className="text-sm opacity-90">{vin.cuvee}</div>}
          {sousTitre && <div className="text-[12.5px] opacity-90">{sousTitre}</div>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="vin-note">
        <VerresLecture note={noteMoyenne} taille={15} />
        {noteMoyenne != null && (
          <span className="text-[13px] font-semibold text-ink">
            {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(noteMoyenne)}
          </span>
        )}
        <span className="text-[12.5px] text-muted">{t("nDegustations", { n: degustations.length })}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          {analyse ? (
            <>
              {/* L'avertissement reste affiché en permanence : la fiche est
                  générée, et rien ne doit se faire passer pour une certitude. */}
              <p data-testid="analyse-avertissement"
                className="flex items-start gap-2 rounded-[5px] border border-line bg-surface-hover px-3 py-2 text-[11.5px] text-muted">
                <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {t("analyse.avertissement")}
              </p>

              {AXES_PROFIL.some((axe) => analyse.profil[axe] != null) && (
                <section>
                  <EnTete titre={t("analyse.profil")} vin={correction} />
                  <dl className="flex flex-col gap-2">
                    {AXES_PROFIL.map((axe) => {
                      const valeur = analyse.profil[axe];
                      const niveau = niveauProfil(valeur);
                      if (niveau == null) return null;
                      return (
                        <div key={axe} data-testid={`profil-${axe}`} className="flex items-center gap-3">
                          <dt className="w-20 shrink-0 text-[12px] text-muted">{t(`analyse.axes.${axe}`)}</dt>
                          <dd className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
                              <span className="block h-full rounded-full bg-accent"
                                style={{ width: `${remplissageProfil(valeur)}%` }} />
                            </span>
                            <span className="shrink-0 text-[12px] text-ink">{t(`analyse.niveaux.${axe}.${niveau}`)}</span>
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              )}

              {analyse.aromes.length > 0 && (
                <section>
                  <SectionLabel>{t("analyse.aromes")}</SectionLabel>
                  <ul className="flex flex-wrap gap-1.5">
                    {analyse.aromes.map((a) => (
                      <li key={a} className="rounded-full border border-line bg-surface-hover px-2.5 py-1 text-[11.5px] text-ink">{a}</li>
                    ))}
                  </ul>
                </section>
              )}

              {analyse.accords.length > 0 && (
                <section>
                  <EnTete titre={t("analyse.accords")} vin={correction} />
                  <ul className="flex flex-wrap gap-1.5">
                    {analyse.accords.map((a) => (
                      <li key={a} className="rounded-full border border-line bg-surface-hover px-2.5 py-1 text-[11.5px] text-ink">{a}</li>
                    ))}
                  </ul>
                </section>
              )}

              {(analyse.service.temperature || analyse.service.carafage || analyse.service.garde) && (
                <section>
                  <SectionLabel>{t("analyse.service")}</SectionLabel>
                  <p className="text-[12.5px] text-ink">
                    {[analyse.service.temperature, analyse.service.carafage, analyse.service.garde]
                      .filter(Boolean).join(" · ")}
                  </p>
                </section>
              )}

              {analyse.presentation && (
                <section>
                  <EnTete titre={t("analyse.domaineEtAppellation")} vin={correction} />
                  <p className="text-[12.5px] leading-relaxed text-ink">{analyse.presentation}</p>
                </section>
              )}
            </>
          ) : (
            // Sans analyse, la fiche doit tout de même donner la main : corriger les
            // champs lus, et lancer une première analyse. Sinon un vin saisi à la
            // main resterait figé, sans aucun moyen d'être complété.
            <div data-testid="analyse-absente" className="flex flex-wrap items-center justify-between gap-2 rounded-[5px] border border-line bg-surface-hover px-3 py-2">
              <p className="text-[12px] text-muted">{t("analyse.absente")}</p>
              <CorrigerButton vin={correction} />
            </div>
          )}

          <section>
            <SectionLabel>{t("mesDegustations")}</SectionLabel>
            <p className="mb-1 text-[11px] text-faint">{t("saisiesParMoi")}</p>
            {degustations.length === 0 ? (
              <p className="text-[12.5px] text-muted">{t("aucuneDegustation")}</p>
            ) : (
              <ul className="flex flex-col">
                {degustations.map((d) => (
                  <li key={d.id} data-testid="degustation-row" className="flex flex-wrap items-center gap-2 border-b border-line-soft py-2.5 text-[12.5px]">
                    <span className="text-muted">{formatDay(d.deguste_le, locale)}</span>
                    {d.lieu_nom && <span className="text-ink">· {d.lieu_nom}</span>}
                    {!d.lieu_nom && d.lieu_type && <span className="text-ink">· {t(`lieux.${d.lieu_type}`)}</span>}
                    {d.commentaire && <span className="text-muted">« {d.commentaire} »</span>}
                    {d.prix_paye != null && (
                      <span className="text-ink">
                        · {d.prix_paye} € {d.prix_unite ? t(`unites.${d.prix_unite}`).toLowerCase() : ""}
                      </span>
                    )}
                    {d.tags.map((tag) => (
                      <span key={tag.id} className="rounded-full border border-line bg-surface-hover px-2 py-0.5 text-[10.5px] text-muted">{tag.label}</span>
                    ))}
                    <span className="ml-auto"><VerresLecture note={d.note} /></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <BuyButton url={vin.achat_url ?? merchantUrl} />
          <Card>
            <SectionLabel>{t("prix")}</SectionLabel>
            <dl className="flex flex-col gap-1.5 text-[12.5px]">
              {prixPaye?.prix_paye != null && (
                <Ligne label={t("prixPaye")} valeur={`${prixPaye.prix_paye} €`} />
              )}
              {analyse?.prixEstime != null && (
                // Explicitement estimé : c'est une valeur générée, pas un tarif.
                <Ligne label={t("analyse.prixEstime")} valeur={`${analyse.prixEstime} €`} />
              )}
              {prixPaye?.prix_paye == null && analyse?.prixEstime == null && (
                <span className="text-muted">{t("prixInconnu")}</span>
              )}
            </dl>
          </Card>
        </aside>
      </div>
    </article>
  );
}

/** Titre de bloc généré + son bouton « Corriger » (design écran 4). */
function EnTete({ titre, vin }: { titre: string; vin: CorrectionVin }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <SectionLabel>{titre}</SectionLabel>
      <CorrigerButton vin={vin} />
    </div>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{valeur}</dd>
    </div>
  );
}
