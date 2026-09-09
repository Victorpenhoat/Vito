import { getTranslations, getFormatter } from "next-intl/server";
import { AlertTriangle, Clock, CalendarClock } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { getAlertesActivites } from "@/features/activites/data/queries";
import { construireAlertes, grouperAlertes, verbeAlerte } from "@/features/activites/domain/alertes";
import { EtatVide } from "@/features/activites/ui/EtatVide";

const ICONE = { en_retard: AlertTriangle, proche: Clock, plus_tard: CalendarClock };
const TEINTE = {
  en_retard: "border-danger/30 bg-danger-bg text-danger",
  proche: "border-current/20 bg-kpi-amber-bg text-kpi-amber",
  plus_tard: "border-line bg-surface-hover text-muted",
};

// « 4 actions à traiter, triées par urgence » : cet écran ne montre pas des
// données, il montre du travail.
export default async function AlertesPage() {
  const t = await getTranslations("activites");
  const format = await getFormatter();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const source = await getAlertesActivites();
  const alertes = construireAlertes(source, aujourdhui);
  const groupes = grouperAlertes(alertes);

  const dateCourte = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <main className="flex flex-col gap-4 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[820px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("alertes.titre")}
        subtitle={alertes.length > 0 ? t("alertes.sousTitre", { n: alertes.length }) : undefined} />
      <Link href="/activites" className="self-start text-[12.5px] font-semibold text-accent hover:underline">
        ← {t("titre")}
      </Link>

      {groupes.length === 0 ? (
        <EtatVide titre={t("alertes.rienTitre")} explication={t("alertes.rienTexte")} />
      ) : (
        groupes.map(({ urgence, alertes: liste }) => {
          const Icone = ICONE[urgence];
          return (
            <section key={urgence} data-testid={`alertes-${urgence}`} className="flex flex-col gap-1.5">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                <Icone size={12} aria-hidden />
                {t(`alertes.groupes.${urgence}`)}
              </h2>
              <ul className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
                {liste.map((a) => (
                  <li key={a.cle} data-testid="alerte-row" className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3.5 py-2.5 last:border-b-0">
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${TEINTE[urgence]}`}>
                      {a.genre === "paiement" ? t("alertes.paiement") : t(`documents.types.${a.libelle}`)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] text-ink">
                        {a.activiteNom}
                        {a.membres.length > 0 ? ` · ${a.membres.join(", ")}` : ""}
                      </span>
                      <span className="truncate text-[11.5px] text-muted">
                        {a.genre === "document" && a.jours
                          ? t("documents.bientot", { n: a.jours })
                          : a.date
                            ? t(urgence === "en_retard" ? "alertes.depuis" : "alertes.pour", { date: dateCourte(a.date) })
                            : t("alertes.sansDate")}
                      </span>
                    </span>
                    {a.montantCents != null && (
                      <span className="shrink-0 text-[13px] tabular-nums text-ink">
                        {format.number(a.montantCents / 100, { style: "currency", currency: a.devise ?? "EUR" })}
                      </span>
                    )}
                    <Link href={`/activites/${a.activiteId}`} data-testid="alerte-traiter"
                      className="shrink-0 text-[11.5px] font-semibold text-accent hover:underline">
                      {t(`alertes.verbes.${verbeAlerte(a)}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}
