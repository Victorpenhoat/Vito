import { getTranslations, getFormatter, getLocale } from "next-intl/server";
import { AlertTriangle, Plane, Sun } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { getActivitesSemaine } from "../data/queries";
import { getMesVoyages } from "@/features/voyages/data/queries";
import { getVacances, getZoneDuFoyer } from "@/features/voyages/data/vacances";
import {
  joursDeLaSemaine, semaineVoisine, occurrencesDuJour, conflitsDuJour, signauxDuJour,
} from "../domain/semaine";
import { EtatVide } from "./EtatVide";
import { deposeDuCreneau } from "../domain/depose";
import { libelleDepose } from "./libelleDepose";
import { GrilleSemaine } from "./GrilleSemaine";

/**
 * « Cette semaine » : l'écran du quotidien.
 *
 * Il dit où il faut être — et surtout où il faut être DEUX FOIS en même temps.
 * Les vacances scolaires viennent de la MÊME source que le planning des
 * voyages — le calendrier du ministère, mis en cache, et la zone du foyer :
 * deux calendriers finiraient par se contredire.
 */
export async function VueSemaine({ semaine, aujourdhui }: {
  /** Date de référence : n'importe quel jour de la semaine à afficher. */
  semaine: string;
  aujourdhui: string;
}) {
  const t = await getTranslations("activites");
  const format = await getFormatter();
  const locale = await getLocale();
  // Ancres ordinaires pour changer de semaine, comme pour les filtres : deux
  // clics rapprochés perdaient la seconde navigation douce.
  const versSemaine = (jour: string) => `/${locale}/activites?onglet=semaine&semaine=${jour}`;
  const jours = joursDeLaSemaine(semaine);
  const [{ activites, exceptions }, voyages, zone] = await Promise.all([
    getActivitesSemaine(jours[0]!, jours[6]!),
    getMesVoyages(),
    getZoneDuFoyer(),
  ]);
  // Sans zone du foyer, aucun calendrier à consulter : la semaine se lit
  // quand même, simplement sans le repère des vacances (c'est l'écran des
  // Réglages qui demande la zone, pas celui-ci).
  const vacances = zone ? await getVacances(zone, jours[0]!, jours[6]!) : [];

  const periodes = voyages.map((v) => ({ id: v.id, titre: v.titre, debut: v.date_debut, fin: v.date_fin }));
  const jourLong = (j: string) =>
    format.dateTime(new Date(`${j}T00:00:00Z`), { weekday: "long", day: "numeric", timeZone: "UTC" });
  const borne = (j: string) =>
    format.dateTime(new Date(`${j}T00:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" });

  const contenu = jours.map((jour) => {
    const occurrences = occurrencesDuJour(activites, jour, exceptions);
    return {
      jour,
      occurrences,
      signaux: signauxDuJour(jour, vacances, periodes),
      // Calculés une fois : la liste et la grille montrent les mêmes conflits.
      conflits: new Set(conflitsDuJour(occurrences).flat().map((o) => o.creneauId)),
    };
  });
  const vide = contenu.every((c) => c.occurrences.length === 0);
  // « Vacances scolaires — reprise le lundi 21 » : une semaine vide pendant les
  // vacances n'est pas un carnet vide, et le dire évite de chercher une panne.
  const vacancesDeLaSemaine = contenu.find((c) => c.signaux.vacances)?.signaux.vacances ?? null;
  const reprise = vacancesDeLaSemaine
    ? new Date(Date.parse(`${vacancesDeLaSemaine.fin}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    : null;

  return (
    <div data-testid="vue-semaine" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <a href={versSemaine(semaineVoisine(semaine, -1))}
          data-testid="semaine-precedente" aria-label={t("semaine.precedente")}
          className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted hover:text-ink">←</a>
        <span data-testid="semaine-titre" className="font-serif text-lg text-ink">
          {t("semaine.du", { debut: borne(jours[0]!), fin: borne(jours[6]!) })}
        </span>
        <a href={versSemaine(semaineVoisine(semaine, 1))}
          data-testid="semaine-suivante" aria-label={t("semaine.suivante")}
          className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted hover:text-ink">→</a>
      </div>

      {/* Sur grand écran, la SEMAINE ENTIÈRE d'un coup d'œil : sept colonnes
          et un rail horaire. La liste par jour reste sur téléphone, où une
          grille de douze heures serait illisible. */}
      {!vide && (
        <GrilleSemaine jours={contenu} aujourdhui={aujourdhui} zone={zone} />
      )}

      {vide ? (
        <EtatVide
          titre={t("vide.semaineTitre")}
          explication={reprise
            ? t("vide.semaineVacances", {
                date: format.dateTime(new Date(`${reprise}T00:00:00Z`), { weekday: "long", day: "numeric", timeZone: "UTC" }),
              })
            : t("vide.semaineTexte")} />
      ) : (
        contenu.map(({ jour, occurrences, signaux, conflits: enConflit }) => {
          if (occurrences.length === 0) return null;
          const conflits = conflitsDuJour(occurrences);
          return (
            <section key={jour} data-testid="semaine-jour"
              className={`flex flex-col gap-1.5 rounded-card border px-3.5 py-2.5 lg:hidden ${
                jour === aujourdhui ? "border-accent/40 bg-accent-50/30" : "border-line bg-surface"
              }`}>
              <header className="flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-semibold text-ink first-letter:uppercase">{jourLong(jour)}</h3>
                {/* `&& zone` n'est pas une garde redondante : `signaux.
                    vacances` est certes toujours nul sans zone (la liste des
                    périodes est vide), mais c'est ce test qui donne à
                    TypeScript le `string` que réclame le libellé ci-dessous.
                    Le retirer casse la compilation, pas le rendu. */}
                {signaux.vacances && zone && (
                  <span data-testid="jour-vacances"
                    className="inline-flex items-center gap-1 rounded-full border border-current/20 bg-kpi-amber-bg px-2 py-0.5 text-[10.5px] font-semibold text-kpi-amber">
                    <Sun size={10} aria-hidden />
                    {t("semaine.vacances", { zone })}
                  </span>
                )}
                {signaux.voyage && (
                  <span data-testid="jour-voyage"
                    className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent-50 px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                    <Plane size={10} aria-hidden />
                    {signaux.voyage.titre}
                  </span>
                )}
              </header>

              {conflits.map((groupe, i) => (
                <p key={i} data-testid="semaine-conflit"
                  className="inline-flex items-center gap-1.5 rounded-control border border-danger/30 bg-danger-bg px-2.5 py-1 text-[11.5px] font-semibold text-danger">
                  <AlertTriangle size={11} aria-hidden />
                  {t("semaine.conflit", { heure: groupe[0]!.heureDebut.replace(":", "h") })}
                </p>
              ))}

              <ul className="flex flex-col">
                {occurrences.map((o) => (
                  <li key={o.creneauId} data-testid="semaine-seance"
                    className="flex flex-wrap items-center gap-2 border-b border-line-soft py-2 last:border-b-0">
                    <span className="w-12 shrink-0 text-[12.5px] font-semibold tabular-nums text-ink">
                      {o.heureDebut.replace(":", "h")}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Link href={`/activites/${o.activiteId}`} className="truncate text-[13.5px] text-ink hover:underline">
                        {o.activiteNom}
                      </Link>
                      {/* Deux lignes courtes plutôt qu'une longue tronquée :
                          le lieu d'un côté, l'heure de fin et le trajet de
                          l'autre. */}
                      <span className="truncate text-[11.5px] text-muted">
                        {[o.clubNom, o.lieuPrecision].filter(Boolean).join(" · ")}
                      </span>
                      <span className="truncate text-[11.5px] text-muted">
                        {[
                          t("semaine.jusqua", { heure: o.heureFin.replace(":", "h") }),
                          libelleDepose(deposeDuCreneau(o), t),
                        ].join(" · ")}
                      </span>
                    </span>
                    {/* Sur un téléphone, les pastilles passent SOUS la ligne :
                        partagées avec le texte, elles le réduisaient à
                        « Équita… · Poney-… », c'est-à-dire à rien. */}
                    <span className="flex basis-full flex-wrap items-center gap-1.5 pl-14 sm:basis-auto sm:shrink-0 sm:pl-0">
                      {o.membres.map((m) => (
                        <span key={m.id} aria-hidden
                          className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white"
                          style={{ background: m.couleur ?? "var(--line)" }}>
                          {m.prenom.slice(0, 1).toUpperCase()}
                        </span>
                      ))}
                      {/* Un voyage fait MANQUER la séance ; les vacances la
                          suspendent seulement — un club ferme souvent, mais pas
                          toujours. On signale, on n'affirme pas. */}
                      {signaux.voyage && (
                        <span data-testid="seance-manquee" className="rounded-full border border-accent/25 bg-accent-50 px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                          {t("semaine.manquee", { voyage: signaux.voyage.titre })}
                        </span>
                      )}
                      {!signaux.voyage && signaux.vacances && (
                        <span data-testid="seance-vacances" className="rounded-full border border-current/20 bg-kpi-amber-bg px-2 py-0.5 text-[10.5px] font-semibold text-kpi-amber">
                          {t("semaine.interrompue")}
                        </span>
                      )}
                      {enConflit.has(o.creneauId) && (
                        <AlertTriangle size={13} className="text-danger" aria-label={t("semaine.enConflit")} />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
