import { Phone, MapPin, Clock } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { getTranslations, getFormatter } from "next-intl/server";
import type { ActiviteListe } from "../data/queries";

const TEINTE_STATUT: Record<string, string> = {
  en_cours: "border-kpi-green/30 bg-kpi-green-bg text-kpi-green",
  en_pause: "border-current/20 bg-kpi-amber-bg text-kpi-amber",
  terminee: "border-line bg-surface-hover text-muted",
};

/**
 * Une activité dans la liste : ce qu'on vient chercher — où, quand — puis les
 * deux gestes du design (appeler le club, s'y rendre), qui n'ouvrent aucun
 * écran intermédiaire.
 */
export async function LigneActivite({ activite, aujourdhui, montrerStatut = false, selectionnee = false }: {
  activite: ActiviteListe;
  aujourdhui: string;
  /** La vue « Tous » mêle les statuts et doit donc les dire. */
  montrerStatut?: boolean;
  /** Mise en évidence de l'activité ouverte à côté, sur grand écran. */
  selectionnee?: boolean;
}) {
  const t = await getTranslations("activites");
  const format = await getFormatter();

  const quand = activite.prochaine
    ? libelleQuand(activite.prochaine.date, activite.prochaine.heureDebut, aujourdhui, format, t)
    : null;
  // Une adresse suffit à mener quelque part ; sans elle, pas de bouton d'itinéraire.
  const itineraire = activite.adresse
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activite.adresse)}`
    : null;

  return (
    <li data-testid="activite-row" aria-current={selectionnee ? "true" : undefined}
      className={`flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0 ${
        selectionnee ? "-mx-3.5 border-l-2 border-l-accent bg-accent-50/40 px-3.5" : ""
      }`}>
      <Link href={`/activites/${activite.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">{activite.nom}</span>
          {montrerStatut && (
            <span data-testid="activite-statut"
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${TEINTE_STATUT[activite.statut] ?? TEINTE_STATUT.terminee}`}>
              {t(`statuts.${activite.statut}`)}
            </span>
          )}
        </span>
        {/* Le club sur sa ligne, l'heure sur la sienne. Tout mettre bout à bout
            faisait tronquer « samedi 10h00 » — c'est-à-dire l'information qu'on
            vient chercher. */}
        {activite.clubNom && (
          <span className="truncate text-[12.5px] text-muted">{activite.clubNom}</span>
        )}
        {(quand || activite.restantes != null) && (
          <span className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
            {quand && (
              <span className="inline-flex items-center gap-1 font-semibold text-accent">
                <Clock size={10} aria-hidden />
                {quand}
              </span>
            )}
            {activite.restantes != null && (
              <span className="text-muted">{t("restantes", { n: activite.restantes })}</span>
            )}
          </span>
        )}
      </Link>

      {activite.telephone && (
        <a href={`tel:${activite.telephone}`} data-testid="activite-appeler" aria-label={t("appeler")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-muted hover:border-accent/30 hover:text-accent">
          <Phone size={14} aria-hidden />
        </a>
      )}
      {itineraire && (
        <a href={itineraire} target="_blank" rel="noopener noreferrer" data-testid="activite-itineraire"
          aria-label={t("itineraire")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-muted hover:border-accent/30 hover:text-accent">
          <MapPin size={14} aria-hidden />
        </a>
      )}
    </li>
  );
}

/** « demain 10h00 », « lundi 17h30 » — jamais une date brute. */
function libelleQuand(
  date: string,
  heure: string,
  aujourdhui: string,
  format: Awaited<ReturnType<typeof getFormatter>>,
  t: Awaited<ReturnType<typeof getTranslations<"activites">>>,
): string {
  const jours = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / 86_400_000,
  );
  const quand =
    jours === 0 ? t("aujourdhui")
    : jours === 1 ? t("demain")
    : format.dateTime(new Date(`${date}T00:00:00Z`), { weekday: "long", timeZone: "UTC" });
  return `${quand} ${heure.replace(":", "h")}`;
}
