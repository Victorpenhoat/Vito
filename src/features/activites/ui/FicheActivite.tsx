import { getTranslations, getFormatter } from "next-intl/server";
import { Phone, MapPin, Globe, Clock, User } from "lucide-react";
import { LienExterne } from "@/features/shared/ui/LienExterne";
import type { ActiviteDetail } from "../data/queries";
import { resumePresence, ordonnerEcheances, etatEcheance, totalRegle } from "../domain/fiche";
import { FormulaireCreneau } from "./FormulaireCreneau";
import { StatutActivite } from "./StatutActivite";
import { SectionAcces } from "./SectionAcces";
import { SectionDocuments } from "./SectionDocuments";

const TEINTE_ECHEANCE: Record<string, string> = {
  paye: "border-kpi-green/30 bg-kpi-green-bg text-kpi-green",
  en_retard: "border-danger/30 bg-danger-bg text-danger",
  a_venir: "border-line bg-surface-hover text-muted",
};

function Section({ titre, children, action }: {
  titre: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{titre}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * La fiche d'une activité : où, quand, avec qui, combien.
 *
 * Rendue par le serveur et partagée par la route dédiée et le panneau droit du
 * desktop — un seul rendu, donc une seule vérité.
 *
 * Les sections Accès et Documents exigent une re-authentification à chaque
 * ouverture : la page ne porte ni les codes ni les fichiers, seulement de quoi
 * les demander.
 */
export async function FicheActivite({ activite, aujourdhui, membresDuFoyer }: {
  activite: ActiviteDetail;
  aujourdhui: string;
  membresDuFoyer: { id: string; prenom: string }[];
}) {
  const t = await getTranslations("activites");
  const format = await getFormatter();
  const presence = resumePresence(activite.seances, activite.formuleSeances);
  const euros = (cents: number, devise: string) =>
    format.number(cents / 100, { style: "currency", currency: devise, maximumFractionDigits: 2 });
  const jour = (n: number) => t(`jours.${n}`);
  const dateCourte = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div data-testid="fiche-activite" className="flex flex-col gap-3">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-2xl text-ink">{activite.nom}</h1>
          <StatutActivite activiteId={activite.id} statut={activite.statut} />
        </div>
        <p className="text-[13px] text-muted">{activite.clubNom}</p>
        <div className="flex flex-wrap gap-1.5">
          {activite.membres.map((m) => (
            <span key={m.id} data-testid="fiche-membre"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] text-ink">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: m.couleur ?? "var(--line)" }} />
              {m.prenom}
            </span>
          ))}
          {activite.tags.map((tag) => (
            <span key={tag.slug} className="rounded-full border border-line bg-surface-hover px-2.5 py-1 text-[11.5px] text-muted">
              {tag.label}
            </span>
          ))}
        </div>
      </header>

      <Section titre={t("sections.horaires")}>
        {activite.creneauxDetail.length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("horaires.aucun")}</p>
        ) : (
          <ul className="flex flex-col">
            {activite.creneauxDetail.map((c) => (
              <li key={c.id} data-testid="fiche-creneau" className="flex flex-col gap-0.5 border-b border-line-soft py-2 last:border-b-0">
                <span className="flex items-center gap-2 text-[13.5px] text-ink">
                  <Clock size={13} className="shrink-0 text-accent" aria-hidden />
                  <span className="font-medium">{jour(c.jourSemaine)}</span>
                  {c.heureDebut.replace(":", "h")} – {c.heureFin.replace(":", "h")}
                </span>
                <span className="pl-[21px] text-[12px] text-muted">
                  {[c.lieuPrecision, c.intervenant && t("horaires.intervenant", { nom: c.intervenant })]
                    .filter(Boolean).join(" · ")}
                </span>
                <span className="pl-[21px] text-[12px] text-muted">
                  {c.deposePar
                    ? t("horaires.depose", { nom: c.deposePar.prenom })
                    : t("horaires.deposeADefinir")}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(activite.saisonDebut || activite.saisonFin) && (
          <p className="text-[11.5px] text-faint">
            {t("horaires.saison", {
              debut: activite.saisonDebut ? dateCourte(activite.saisonDebut) : "—",
              fin: activite.saisonFin ? dateCourte(activite.saisonFin) : "—",
            })}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <FormulaireCreneau activiteId={activite.id} membres={membresDuFoyer} />
          {activite.creneauxDetail.length > 0 && (
            // Un lien ordinaire : le fichier se télécharge, l'agenda du système
            // s'en occupe. Rien de protégé là-dedans — des horaires, un lieu.
            <a href={`/api/activites/${activite.id}/ics`} data-testid="fiche-ics"
              className="text-[11.5px] font-semibold text-accent hover:underline">
              {t("horaires.calendrier")} ↓
            </a>
          )}
        </div>
        <p className="text-[11px] text-faint">{t("horaires.dansPlanning")}</p>
      </Section>

      {presence.formule != null && (
        <Section titre={t("sections.presence")}>
          <p data-testid="fiche-presence" className="text-[13.5px] text-ink">
            {t("presence.formule", { n: presence.formule })} · {presence.consommees} / {presence.formule}
          </p>
          <p className="text-[12.5px] text-muted">
            {t("presence.faites", { n: presence.faites })} · {t("presence.manquees", { n: presence.manquees })}
            {presence.restantes != null ? ` · ${t("restantes", { n: presence.restantes })}` : ""}
          </p>
        </Section>
      )}

      <Section titre={t("sections.lieu")}>
        {activite.adresse && (
          <p className="flex items-start gap-2 text-[13.5px] text-ink">
            <MapPin size={13} className="mt-1 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">{activite.adresse}</span>
            <LienExterne
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activite.adresse)}`}
              className="shrink-0 text-[11.5px] font-semibold text-accent hover:underline">
              {t("lieu.maps")} ↗
            </LienExterne>
          </p>
        )}
        {activite.telephone && (
          <p className="flex items-center gap-2 text-[13.5px] text-ink">
            <Phone size={13} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">{activite.telephone}</span>
            <a href={`tel:${activite.telephone}`} className="shrink-0 text-[11.5px] font-semibold text-accent hover:underline">
              {t("appeler")}
            </a>
          </p>
        )}
        {activite.espaceFamilleUrl && (
          <p className="flex items-center gap-2 text-[13.5px] text-ink">
            <Globe size={13} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">{t("lieu.espaceFamille")}</span>
            <LienExterne href={activite.espaceFamilleUrl} className="shrink-0 text-[11.5px] font-semibold text-accent hover:underline">
              {t("lieu.ouvrir")} ↗
            </LienExterne>
          </p>
        )}
        {!activite.adresse && !activite.telephone && (
          <p className="text-[12.5px] text-muted">{t("lieu.aucun")}</p>
        )}
      </Section>

      <Section titre={t("sections.cout")}>
        {activite.paiements.length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("cout.aucun")}</p>
        ) : (
          <>
            <p className="text-[13px] text-muted">
              {t("cout.regle")} <span className="font-serif text-lg text-ink">
                {euros(totalRegle(activite.paiements), activite.paiements[0]!.devise)}
              </span>
            </p>
            <ul className="flex flex-col">
              {ordonnerEcheances(activite.paiements, aujourdhui).map((p) => {
                const etat = etatEcheance(p, aujourdhui);
                return (
                  <li key={p.id} data-testid="fiche-echeance" className="flex items-center gap-2 border-b border-line-soft py-2 last:border-b-0">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.libelle}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${TEINTE_ECHEANCE[etat]}`}>
                      {t(`cout.etats.${etat}`)}
                    </span>
                    {p.echeance && <span className="shrink-0 text-[11.5px] text-muted">{dateCourte(p.echeance)}</span>}
                    <span className="shrink-0 text-[13px] tabular-nums text-ink">{euros(p.montantCents, p.devise)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Section>

      <SectionAcces activiteId={activite.id} codes={activite.codes} />

      <SectionDocuments activiteId={activite.id} documents={activite.documents} aujourdhui={aujourdhui} />

      {activite.notes && (
        <Section titre={t("sections.notes")}>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink">{activite.notes}</p>
        </Section>
      )}

      {activite.consignesAcces && (
        <Section titre={t("sections.consignes")}>
          {/* Une consigne d'accès n'est pas un secret : le code, lui, attend le
              prochain incrément et sa re-authentification. */}
          <p className="flex items-start gap-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink">
            <User size={13} className="mt-1 shrink-0 text-accent" aria-hidden />
            {activite.consignesAcces}
          </p>
        </Section>
      )}
    </div>
  );
}
