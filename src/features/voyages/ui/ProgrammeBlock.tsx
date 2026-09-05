"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { useRouter } from "@/lib/i18n/routing";
import { addEtape, removeEtape } from "../data/actions";
import { joursDuVoyage } from "../domain/programme";
import {
  elementsDuJour, resumeJour,
  type ElementProgramme, type EtapeProgramme, type ReservationProgramme,
} from "../domain/programmeJournee";
import { CATEGORIES_ETAPE, MOMENTS_ETAPE } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";

// Programme du voyage (Lot B) : les jours du séjour, et ce qu'on y prévoit.
// Un jour sans rien reste affiché — c'est une journée à remplir. Une envie sans
// date va dans « à caler » plutôt que d'attendre qu'on lui trouve un jour.
export function ProgrammeBlock({ voyageId, etapes, reservations, dateDebut, dateFin }: {
  voyageId: string;
  etapes: EtapeProgramme[];
  /** Les réservations du voyage : la maquette dit qu'elles « apparaissent
   *  automatiquement » — on ne les ressaisit pas, on les montre à leur date. */
  reservations: ReservationProgramme[];
  dateDebut: string | null;
  dateFin: string | null;
}) {
  const t = useTranslations("voyages");
  const format = useFormatter();
  const router = useRouter();
  const [saisieSur, setSaisieSur] = useState<string | null>(null);
  const [jourActif, setJourActif] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Affichage optimiste, même raison qu'au bloc Voyageurs : l'écran montre ce
  // qui vient d'être écrit sans attendre un rafraîchissement RSC qui peut ne
  // jamais se commettre (#71/#77) ; les props reprennent la main ensuite.
  const [ajoutees, setAjoutees] = useState<EtapeProgramme[]>([]);
  const [supprimees, setSupprimees] = useState<string[]>([]);
  const connues = new Set(etapes.map((e) => e.id));
  const visibles = [...etapes, ...ajoutees.filter((a) => !connues.has(a.id))]
    .filter((e) => !supprimees.includes(e.id));

  // « à caler » ouvre sa propre saisie, sous la clé vide : un voyage sans dates
  // (une idée) n'a que celle-là.
  const CLE_A_CALER = "";
  const jours = joursDuVoyage(dateDebut, dateFin);
  // Onglet ouvert : le jour choisi, sinon le premier du voyage (la maquette
  // ouvre sur l'arrivée).
  const jour = jourActif && jours.includes(jourActif) ? jourActif : (jours[0] ?? CLE_A_CALER);
  // « À caler » reste accessible : une envie sans date ne doit pas se perdre
  // parce que le programme est devenu un calendrier.
  const aCaler = visibles.filter((e) => !e.jour || !jours.includes(e.jour));

  async function ajouter(jour: string, form: HTMLFormElement) {
    // Toute la FormData est lue AVANT le premier await : après, currentTarget
    // est nul et la promesse casse en silence (piège du lot V-C).
    const fd = new FormData(form);
    fd.set("voyageId", voyageId);
    if (jour) fd.set("jour", jour);
    else fd.delete("jour");
    // Exclusivité heure/moment : le moment choisi l'emporte, sinon le schéma
    // refuserait la saisie sans que l'écran sache pourquoi.
    if (fd.get("moment")) fd.delete("heure");
    if (!String(fd.get("titre") ?? "").trim()) return;

    setEnCours(true);
    setErreur(null);
    const heure = String(fd.get("heure") ?? "") || null;
    const titre = String(fd.get("titre") ?? "").trim();
    const lieu = String(fd.get("lieu") ?? "").trim() || null;
    const res = await addEtape(undefined, fd);
    setEnCours(false);
    if (!("id" in res) || !res.id) {
      setErreur(("error" in res && res.error) || t("programme.echec"));
      return;
    }
    setAjoutees((liste) => [...liste, {
      id: res.id, jour: jour || null, heure, titre, lieu,
      etablissementId: null, notes: null, ordre: res.ordre ?? 0,
      categorie: String(fd.get("categorie") ?? "") || null,
      moment: String(fd.get("moment") ?? "") || null,
    }]);
    form.reset();
    setSaisieSur(null);
    router.refresh();
  }

  async function supprimer(etapeId: string) {
    const fd = new FormData();
    fd.set("voyageId", voyageId);
    fd.set("etapeId", etapeId);
    const res = await removeEtape(undefined, fd);
    if (res?.error) { setErreur(res.error); return; }
    setSupprimees((liste) => [...liste, etapeId]);
    router.refresh();
  }

  const jourCourt = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { weekday: "short", day: "numeric", timeZone: "UTC" });
  const jourLong = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div data-testid="programme" className="flex flex-col gap-3">
      {erreur && <p role="alert" className="text-[12px] text-danger">{erreur}</p>}

      {/* Onglets par jour, avec leur résumé : arrivée, retour, N étapes, libre. */}
      {jours.length > 0 && (
        <div data-testid="programme-onglets" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 [scrollbar-width:none]">
          {jours.map((j) => {
            const resume = resumeJour(j, jours, visibles, reservations);
            return (
              <button key={j} type="button" data-testid="programme-onglet-jour" aria-pressed={j === jour}
                onClick={() => setJourActif(j)}
                className={`flex shrink-0 flex-col items-start rounded-card border px-3 py-2 text-left ${
                  j === jour ? "border-accent/30 bg-accent-50" : "border-line bg-surface hover:bg-surface-hover"
                }`}>
                <span className={`text-[12px] font-semibold ${j === jour ? "text-accent" : "text-ink"}`}>
                  {jourCourt(j)}
                </span>
                <span className="text-[10.5px] text-muted">
                  {resume.cle === "etapes" ? t("programme.resume.etapes", { n: resume.n ?? 0 })
                    : t(`programme.resume.${resume.cle}`)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {jours.length > 0 && (
        <section data-testid="programme-jour" className="flex flex-col gap-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{jourLong(jour)}</h3>
          <ListeJournee elements={elementsDuJour(jour, visibles, reservations)}
            vide={t("programme.jourVide")} onSupprimer={supprimer} t={t} />
          <FormEtape ouvert={saisieSur === jour} onOuvrir={() => setSaisieSur(jour)}
            onFermer={() => setSaisieSur(null)} onAjouter={(form) => ajouter(jour, form)}
            enCours={enCours} t={t} avecHeure jourLabel={jourCourt(jour)} />
        </section>
      )}

      <section data-testid="programme-a-caler" className="flex flex-col gap-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("programme.aCaler")}</h3>
        <ListeJournee elements={aCaler.map((e) => ({ cle: `etape-${e.id}`, source: "etape" as const, heure: e.heure, moment: e.moment, etape: e }))}
          vide={t("programme.aCalerVide")} onSupprimer={supprimer} t={t} />
        <FormEtape ouvert={saisieSur === CLE_A_CALER} onOuvrir={() => setSaisieSur(CLE_A_CALER)}
          onFermer={() => setSaisieSur(null)} onAjouter={(form) => ajouter(CLE_A_CALER, form)}
          enCours={enCours} t={t} avecHeure={false} />
      </section>
    </div>
  );
}

type T = ReturnType<typeof useTranslations<"voyages">>;

function ListeJournee({ elements, vide, onSupprimer, t }: {
  elements: ElementProgramme[]; vide: string; onSupprimer: (id: string) => void; t: T;
}) {
  if (elements.length === 0) return <p className="text-[12px] text-faint">{vide}</p>;
  return (
    <ul className="flex flex-col">
      {elements.map((el) => {
        // Une réservation figure ici en LECTURE : elle se modifie dans sa
        // section, pas dans le programme — sinon deux vérités cohabiteraient.
        if (el.source === "reservation" && el.reservation) {
          const r = el.reservation;
          return (
            <li key={el.cle} data-testid="programme-reservation"
              className="flex items-baseline gap-2 border-b border-line-soft py-2">
              <span className="w-14 shrink-0 text-[11.5px] tabular-nums text-accent">{r.heure ?? ""}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">{r.libelle}</span>
                <span className="block truncate text-[11.5px] text-muted">
                  {[t(`types.${r.type}`), r.resume].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-accent/25 bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {t("programme.reservationLiee")}
              </span>
            </li>
          );
        }
        const e = el.etape!;
        return (
        <li key={el.cle} data-testid="programme-etape" className="flex items-baseline gap-2 border-b border-line-soft py-2">
          <span className="w-14 shrink-0 text-[11.5px] tabular-nums text-accent">
            {e.heure ?? (e.moment ? t(`programme.moments.${e.moment}`) : "")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] text-ink">{e.titre}</span>
            {(e.categorie || e.lieu || e.notes) && (
              <span className="block truncate text-[11.5px] text-muted">
                {[e.categorie ? t(`programme.categories.${e.categorie}`) : null, e.lieu, e.notes]
                  .filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          <button type="button" data-testid="etape-supprimer" aria-label={t("programme.supprimer", { titre: e.titre })}
            onClick={() => onSupprimer(e.id)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-line text-muted focus-visible:outline-2 focus-visible:outline-accent">
            <X size={11} aria-hidden />
          </button>
        </li>
        );
      })}
    </ul>
  );
}

function FormEtape({ ouvert, onOuvrir, onFermer, onAjouter, enCours, t, avecHeure, jourLabel }: {
  ouvert: boolean; onOuvrir: () => void; onFermer: () => void;
  onAjouter: (form: HTMLFormElement) => void; enCours: boolean; t: T; avecHeure: boolean;
  /** « Ajouter une étape au lundi » — la maquette nomme le jour visé. */
  jourLabel?: string;
}) {
  if (!ouvert) {
    return (
      <button type="button" data-testid="etape-ajouter" onClick={onOuvrir}
        className="inline-flex items-center gap-1 self-start py-1 text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
        <Plus size={12} aria-hidden />
        {jourLabel ? t("programme.ajouterAu", { jour: jourLabel }) : t("programme.ajouter")}
      </button>
    );
  }
  return (
    <form data-testid="etape-form" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3"
      onSubmit={(e) => { e.preventDefault(); onAjouter(e.currentTarget); }}>
      <div className="flex gap-2">
        {avecHeure && (
          <input type="time" name="heure" data-testid="etape-heure" aria-label={t("programme.heure")}
            className="w-24 rounded-control border border-line bg-surface px-2 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
        )}
        <input name="titre" data-testid="etape-titre" placeholder={t("programme.titrePlaceholder")}
          aria-label={t("programme.titrePlaceholder")}
          className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
      </div>
      <div className="flex gap-2">
        <select name="categorie" data-testid="etape-categorie" aria-label={t("programme.categorie")} defaultValue=""
          className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent">
          <option value="">{t("programme.sansCategorie")}</option>
          {CATEGORIES_ETAPE.map((c) => <option key={c} value={c}>{t(`programme.categories.${c}`)}</option>)}
        </select>
        {/* Un moment plutôt qu'une heure : « Soir · gelato ». Les deux ensemble
            se contrediraient — la base l'interdit, l'écran ne le propose pas. */}
        <select name="moment" data-testid="etape-moment" aria-label={t("programme.moment")} defaultValue=""
          className="w-32 rounded-control border border-line bg-surface px-2 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent">
          <option value="">{t("programme.sansMoment")}</option>
          {MOMENTS_ETAPE.map((m) => <option key={m} value={m}>{t(`programme.moments.${m}`)}</option>)}
        </select>
      </div>
      <input name="lieu" data-testid="etape-lieu" placeholder={t("programme.lieuPlaceholder")}
        aria-label={t("programme.lieuPlaceholder")}
        className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
      <div className="flex gap-2">
        <Button type="submit" data-testid="etape-valider" pending={enCours}>{t("programme.valider")}</Button>
        <Button type="button" variant="ghost" onClick={onFermer}>{t("programme.annuler")}</Button>
      </div>
    </form>
  );
}
