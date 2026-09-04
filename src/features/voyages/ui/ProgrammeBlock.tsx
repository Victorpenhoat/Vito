"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { useRouter } from "@/lib/i18n/routing";
import { addEtape, removeEtape } from "../data/actions";
import { grouperEtapes, joursDuVoyage, type Etape } from "../domain/programme";
import { Button } from "@/features/shared/ui/Button";

// Programme du voyage (Lot B) : les jours du séjour, et ce qu'on y prévoit.
// Un jour sans rien reste affiché — c'est une journée à remplir. Une envie sans
// date va dans « à caler » plutôt que d'attendre qu'on lui trouve un jour.
export function ProgrammeBlock({ voyageId, etapes, dateDebut, dateFin }: {
  voyageId: string;
  etapes: Etape[];
  dateDebut: string | null;
  dateFin: string | null;
}) {
  const t = useTranslations("voyages");
  const format = useFormatter();
  const router = useRouter();
  const [saisieSur, setSaisieSur] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Affichage optimiste, même raison qu'au bloc Voyageurs : l'écran montre ce
  // qui vient d'être écrit sans attendre un rafraîchissement RSC qui peut ne
  // jamais se commettre (#71/#77) ; les props reprennent la main ensuite.
  const [ajoutees, setAjoutees] = useState<Etape[]>([]);
  const [supprimees, setSupprimees] = useState<string[]>([]);
  const connues = new Set(etapes.map((e) => e.id));
  const visibles = [...etapes, ...ajoutees.filter((a) => !connues.has(a.id))]
    .filter((e) => !supprimees.includes(e.id));

  const jours = joursDuVoyage(dateDebut, dateFin);
  const { jours: programme, aCaler } = grouperEtapes(visibles, jours);

  // « à caler » ouvre sa propre saisie, sous la clé vide : un voyage sans dates
  // (une idée) n'a que celle-là.
  const CLE_A_CALER = "";

  async function ajouter(jour: string, form: HTMLFormElement) {
    // Toute la FormData est lue AVANT le premier await : après, currentTarget
    // est nul et la promesse casse en silence (piège du lot V-C).
    const fd = new FormData(form);
    fd.set("voyageId", voyageId);
    if (jour) fd.set("jour", jour);
    else fd.delete("jour");
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

  const jourLong = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div data-testid="programme" className="flex flex-col gap-3">
      {erreur && <p role="alert" className="text-[12px] text-danger">{erreur}</p>}

      {programme.map(({ jour, etapes: duJour }) => (
        <section key={jour} data-testid="programme-jour" className="flex flex-col gap-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{jourLong(jour)}</h3>
          <ListeEtapes etapes={duJour} vide={t("programme.jourVide")} onSupprimer={supprimer} t={t} />
          <FormEtape ouvert={saisieSur === jour} onOuvrir={() => setSaisieSur(jour)}
            onFermer={() => setSaisieSur(null)} onAjouter={(form) => ajouter(jour, form)}
            enCours={enCours} t={t} avecHeure />
        </section>
      ))}

      <section data-testid="programme-a-caler" className="flex flex-col gap-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("programme.aCaler")}</h3>
        <ListeEtapes etapes={aCaler} vide={t("programme.aCalerVide")} onSupprimer={supprimer} t={t} />
        <FormEtape ouvert={saisieSur === CLE_A_CALER} onOuvrir={() => setSaisieSur(CLE_A_CALER)}
          onFermer={() => setSaisieSur(null)} onAjouter={(form) => ajouter(CLE_A_CALER, form)}
          enCours={enCours} t={t} avecHeure={false} />
      </section>
    </div>
  );
}

type T = ReturnType<typeof useTranslations<"voyages">>;

function ListeEtapes({ etapes, vide, onSupprimer, t }: {
  etapes: Etape[]; vide: string; onSupprimer: (id: string) => void; t: T;
}) {
  if (etapes.length === 0) return <p className="text-[12px] text-faint">{vide}</p>;
  return (
    <ul className="flex flex-col">
      {etapes.map((e) => (
        <li key={e.id} data-testid="programme-etape" className="flex items-baseline gap-2 border-b border-line-soft py-2">
          {e.heure && <span className="shrink-0 text-[11.5px] tabular-nums text-accent">{e.heure}</span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] text-ink">{e.titre}</span>
            {(e.lieu || e.notes) && (
              <span className="block truncate text-[11.5px] text-muted">
                {[e.lieu, e.notes].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          <button type="button" data-testid="etape-supprimer" aria-label={t("programme.supprimer", { titre: e.titre })}
            onClick={() => onSupprimer(e.id)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-line text-muted focus-visible:outline-2 focus-visible:outline-accent">
            <X size={11} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

function FormEtape({ ouvert, onOuvrir, onFermer, onAjouter, enCours, t, avecHeure }: {
  ouvert: boolean; onOuvrir: () => void; onFermer: () => void;
  onAjouter: (form: HTMLFormElement) => void; enCours: boolean; t: T; avecHeure: boolean;
}) {
  if (!ouvert) {
    return (
      <button type="button" data-testid="etape-ajouter" onClick={onOuvrir}
        className="inline-flex items-center gap-1 self-start py-1 text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
        <Plus size={12} aria-hidden />
        {t("programme.ajouter")}
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
