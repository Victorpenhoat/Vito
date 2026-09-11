import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { Link } from "@/lib/i18n/routing";
import { getMesVoyages, compterParticipants } from "@/features/voyages/data/queries";
import { getVacances, getZoneDuFoyer } from "@/features/voyages/data/vacances";
import { fenetreDepuis, MOIS_PLANNING } from "@/features/voyages/domain/planning";
import { AutresZonesInterrupteur } from "@/features/voyages/ui/AutresZonesInterrupteur";
import { PlanningCalendrier } from "@/features/voyages/ui/PlanningCalendrier";
import { PlanningFrise } from "@/features/voyages/ui/PlanningFrise";
import { getActivitesSemaine } from "@/features/activites/data/queries";
import { ZONES_METROPOLE, estMetropole } from "@/features/voyages/domain/zoneScolaire";

// Planning (maquettes « Planning Mois » et « Web — Planning global ») : un
// calendrier, les voyages sous la semaine qu'ils traversent, et l'année
// scolaire qui montre ce qui reste libre.
export default async function PlanningPage() {
  const t = await getTranslations("voyages");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [voyages, participants, semaine, zone] = await Promise.all([
    getMesVoyages(),
    compterParticipants(),
    // Les créneaux d'activités se superposent au planning : « où serons-nous »
    // et « qui a cours » sont la même question quand on prépare un départ.
    getActivitesSemaine(aujourdhui, aujourdhui),
    getZoneDuFoyer(),
  ]);
  const creneaux = semaine.activites.flatMap((a) =>
    a.creneaux.map((c) => ({ jourSemaine: c.jourSemaine, valideDu: c.valideDu, valideAu: c.valideAu })));

  // La MÊME fenêtre que la frise, tirée de la même constante : deux calculs de
  // douze mois côte à côte finiraient par diverger d'un jour, et le calendrier
  // manquerait sa dernière période sans que personne comprenne pourquoi.
  const fenetre = fenetreDepuis(new Date(`${aujourdhui}T00:00:00Z`), MOIS_PLANNING);
  const vacances = zone ? await getVacances(zone, fenetre.debut, fenetre.fin) : [];

  const veutAutres = (await cookies()).get("zones_autres")?.value === "1";
  const autresZones = veutAutres && estMetropole(zone)
    ? await Promise.all(
        ZONES_METROPOLE.filter((z) => z !== zone)
          .map(async (z) => ({ zone: z, periodes: await getVacances(z, fenetre.debut, fenetre.fin) })),
      )
    : [];

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1000px]">
      <div className="flex flex-col gap-2">
        <PageHeader eyebrow={t("eyebrow")} title={t("planning.titre")} />
        <Link href="/voyages" data-testid="planning-retour" className="text-[12.5px] font-semibold text-accent hover:underline">
          ← {t("planning.retour")}
        </Link>
        {estMetropole(zone) && <AutresZonesInterrupteur actif={veutAutres} />}
      </div>
      <PlanningCalendrier
        voyages={voyages.map((v) => ({
          id: v.id, titre: v.titre, debut: v.date_debut, fin: v.date_fin,
          statut: v.statut, participants: participants[v.id] ?? 0,
        }))}
        vacances={vacances}
        aujourdhui={aujourdhui}
        zone={zone}
        autresZones={autresZones}
        creneaux={creneaux}
        vueAnnee={
          <PlanningFrise
            voyages={voyages.map((v) => ({ id: v.id, titre: v.titre, debut: v.date_debut, fin: v.date_fin }))}
            vacances={vacances}
            zone={zone}
            autresZones={autresZones}
            aujourdhui={aujourdhui} />
        }
      />
    </main>
  );
}
