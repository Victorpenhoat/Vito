"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useRouter } from "@/lib/i18n/routing";
import { addDepenseVoyage, removeDepenseVoyage, addRemboursementVoyage } from "../data/actions";
import {
  soldesParticipants, transfertsSimplifies, totalDepenses,
  type DepenseVoyage, type RemboursementVoyage,
} from "../domain/depensesVoyage";
import type { Participant } from "../domain/participants";
import { participantMoi, maPart, porteeDepense, parPersonne } from "../domain/depensesResume";
import { CATEGORIES_DEPENSE } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { PiecesJointes } from "./PiecesJointes";
import { FileField } from "@/features/shared/ui/FileField";
import { ajouterDocument } from "../data/documents";
import { tauxDeChange } from "../data/taux";
import { DEVISES, conversionAffichable, convertir, tauxSaisi } from "../domain/devises";

function Chiffre({ label, valeur, teinte, note }: {
  label: string; valeur: string; teinte?: string; note?: string;
}) {
  return (
    <span className="flex flex-col">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">{label}</span>
      <span className={`font-serif text-lg ${teinte ?? "text-ink"}`}>{valeur}</span>
      {note && <span className="text-[10.5px] text-muted">{note}</span>}
    </span>
  );
}

type DepenseAffichee = DepenseVoyage & {
  libelle: string; date: string | null; categorie: string | null;
  /** D'où vient le montant quand il vient d'ailleurs (null sinon). */
  deviseSaisie?: string | null; montantSaisiCents?: number | null;
  taux?: number | null; tauxDate?: string | null;
};

// Dépenses du voyage (Lot D) : le partage entre VOYAGEURS, y compris ceux qui
// n'ont pas de compte. Sans voyageur, il n'y a personne entre qui partager —
// le bloc invite alors à en ajouter plutôt que d'afficher un formulaire mort.
export function DepensesVoyageBlock({
  voyageId, participants, depenses, remboursements, devise, monProfileId, tickets, aujourdhui,
}: {
  voyageId: string;
  participants: Participant[];
  depenses: DepenseAffichee[];
  remboursements: (RemboursementVoyage & { id: string })[];
  devise: string;
  /** Mon compte, pour dire « ma part » et « mon solde » — la maquette les met
   *  en tête, avant même la liste : c'est ce qu'on vient chercher. */
  monProfileId: string | null;
  /** Tickets déjà déposés, par dépense (documents du voyage). */
  tickets: { id: string; nom: string; taille: number; depenseId: string | null }[];
  /** « YYYY-MM-DD » daté par le SERVEUR : c'est la date du taux proposé. */
  aujourdhui: string;
}) {
  const t = useTranslations("voyages.depensesVoyage");
  const format = useFormatter();
  const router = useRouter();
  const [onglet, setOnglet] = useState<"depenses" | "equilibres">("depenses");
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<"egal" | "exact">("egal");
  const [montantSaisi, setMontantSaisi] = useState("");
  const [partages, setPartages] = useState<string[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [supprimees, setSupprimees] = useState<string[]>([]);
  // Saisie en devise locale (maquette : « 86,50 [EUR ▾] »). Par défaut celle du
  // voyage, auquel cas il n'y a ni taux ni conversion à montrer.
  const [deviseSaisie, setDeviseSaisie] = useState(devise);
  const [taux, setTaux] = useState<number | null>(null);
  const [tauxDate, setTauxDate] = useState<string | null>(null);
  const [tauxCherche, setTauxCherche] = useState(false);
  const [tauxCorrige, setTauxCorrige] = useState("");

  const visibles = depenses.filter((d) => !supprimees.includes(d.id));
  const nom = (id: string) => participants.find((p) => p.id === id)?.displayName ?? "—";
  /** « 14/10 » : le jour du taux, dit court comme dans la maquette. */
  const jourCourt = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
  const euros = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: devise, maximumFractionDigits: 2 });

  /**
   * Le taux du jour, proposé dès qu'on choisit une devise étrangère. On ne
   * bloque pas la saisie s'il n'arrive pas : l'écran demande alors de le taper,
   * ce qui reste préférable à un chiffre inventé.
   */
  async function choisirDevise(code: string) {
    setDeviseSaisie(code);
    setTauxCorrige("");
    if (code === devise) { setTaux(null); setTauxDate(null); return; }
    setTauxCherche(true);
    const res = await tauxDeChange(code, devise, aujourdhui);
    setTauxCherche(false);
    setTaux(res?.taux ?? null);
    setTauxDate(res?.date ?? aujourdhui);
  }

  const etrangere = deviseSaisie !== devise;
  const montantCentsSaisis = (() => {
    const cents = Math.round(Number(montantSaisi.replace(",", ".")) * 100);
    return Number.isFinite(cents) && cents > 0 ? cents : null;
  })();
  /** Ce que la dépense pèse POUR LE VOYAGE : c'est là-dessus que tout se compte. */
  const montantCentsVoyage = montantCentsSaisis == null ? null
    : etrangere ? (taux != null ? convertir(montantCentsSaisis, taux) : null)
    : montantCentsSaisis;

  const soldes = soldesParticipants(participants.map((p) => p.id), visibles, remboursements);
  const transferts = transfertsSimplifies(soldes);
  const moi = participantMoi(participants.map((p) => ({ id: p.id, profileId: p.profileId })), monProfileId);
  const monSolde = moi ? (soldes.find((s) => s.participantId === moi.id)?.soldeCents ?? 0) : null;
  const mesDepenses = maPart(visibles, moi?.id ?? null);

  if (participants.length === 0) {
    return <p data-testid="depenses-sans-voyageur" className="text-[12.5px] text-muted">{t("sansVoyageur")}</p>;
  }

  async function envoyer(form: HTMLFormElement, action: typeof addDepenseVoyage) {
    // FormData lue avant tout await (piège du lot V-C).
    const fd = new FormData(form);
    fd.set("voyageId", voyageId);
    setEnCours(true);
    setErreur(null);
    const res = await action(undefined, fd);
    setEnCours(false);
    if (!("id" in res) || !res.id) {
      setErreur(("error" in res && res.error) || t("echec"));
      return null;
    }
    form.reset();
    // Les soldes se recalculent à partir des données du serveur : ici, pas
    // d'affichage optimiste possible sans dupliquer le calcul — on demande donc
    // un rendu frais, et l'écran attend d'avoir la vérité pour l'afficher.
    router.refresh();
    return res.id as string;
  }

  /**
   * Le ticket de la maquette : photographié en même temps qu'on saisit la
   * dépense, donc déposé dans la foulée de sa création. Un échec de dépôt ne
   * défait pas la dépense — elle est juste, seule la preuve manque — mais il se
   * dit, sans quoi on croirait le ticket rangé.
   */
  async function deposerTicket(fichier: File, depenseId: string) {
    const fd = new FormData();
    fd.set("voyageId", voyageId);
    fd.set("depenseId", depenseId);
    fd.set("file", fichier);
    const res = await ajouterDocument(undefined, fd);
    if (!("id" in res) || !res.id) setErreur(("error" in res && res.error) || t("ticketEchec"));
    else router.refresh();
  }

  /** Confirme le transfert proposé, sans le ressaisir (maquette « Marquer comme remboursé »). */
  async function rembourser(de: string, vers: string, montantCents: number) {
    setEnCours(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("voyageId", voyageId);
    fd.set("deParticipantId", de);
    fd.set("versParticipantId", vers);
    // L'action attend des euros (centsFromEuros) : on repasse par la même porte
    // que la saisie manuelle plutôt que d'ouvrir un chemin parallèle.
    fd.set("montant", (montantCents / 100).toFixed(2));
    const res = await addRemboursementVoyage(undefined, fd);
    setEnCours(false);
    if (!("id" in res) || !res.id) {
      setErreur(("error" in res && res.error) || t("echec"));
      return;
    }
    router.refresh();
  }

  async function supprimer(depenseId: string) {
    const fd = new FormData();
    fd.set("voyageId", voyageId);
    fd.set("depenseId", depenseId);
    const res = await removeDepenseVoyage(undefined, fd);
    if (res?.error) { setErreur(res.error); return; }
    setSupprimees((liste) => [...liste, depenseId]);
    router.refresh();
  }

  return (
    <div data-testid="depenses-voyage" className="flex flex-col gap-3">
      {/* En-tête de la maquette : ce que coûte le voyage, puis ce qu'il me coûte. */}
      <div data-testid="depenses-entete" className="grid grid-cols-3 gap-2 rounded-card border border-line bg-surface p-3">
        <Chiffre label={t("total")} valeur={euros(totalDepenses(visibles))} />
        {moi ? (
          <>
            <Chiffre label={t("maPart")} valeur={euros(mesDepenses)} />
            <Chiffre label={t("monSolde")} valeur={euros(monSolde ?? 0)}
              teinte={(monSolde ?? 0) > 0 ? "text-kpi-green" : (monSolde ?? 0) < 0 ? "text-danger" : "text-muted"}
              note={(monSolde ?? 0) > 0 ? t("onMeDoit") : (monSolde ?? 0) < 0 ? t("jeDois") : undefined} />
          </>
        ) : (
          // Je ne figure pas parmi les voyageurs : il n'y a pas de « ma part »
          // à inventer, on le dit plutôt que d'afficher zéro.
          <span data-testid="depenses-pas-voyageur" className="col-span-2 self-center text-[11.5px] text-muted">
            {t("pasVoyageur")}
          </span>
        )}
      </div>

      <div className="flex gap-1 self-start rounded-control border border-line p-0.5">
        {(["depenses", "equilibres"] as const).map((o) => (
          <button key={o} type="button" data-testid={`onglet-${o}`} aria-pressed={onglet === o}
            onClick={() => setOnglet(o)}
            className={`rounded-control px-3 py-1.5 text-[11.5px] font-semibold ${
              onglet === o ? "bg-accent text-white" : "text-muted hover:text-ink"
            }`}>
            {t(`onglets.${o}`)}
          </button>
        ))}
      </div>

      {erreur && <p role="alert" className="text-[12px] text-danger">{erreur}</p>}

      {onglet === "depenses" && visibles.length > 0 && (
        <ul className="flex flex-col">
          {visibles.map((d) => (
            <li key={d.id} data-testid="depense-row" className="flex flex-wrap items-center gap-2 border-b border-line-soft py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">{d.libelle}</span>
                <span className="block truncate text-[11.5px] text-muted">
                  {t("payePar", { nom: nom(d.payePar) })}
                  {d.date ? ` · ${format.dateTime(new Date(`${d.date}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" })}` : ""}
                  {" · "}
                  {porteeDepense(d, participants.length).tous
                    ? t("pourTous")
                    : t("pourN", { n: porteeDepense(d, participants.length).nb })}
                  {d.categorie ? ` · ${t(`categories.${d.categorie}`)}` : ""}
                </span>
                {(() => {
                  // « 52 $ · taux du 14/10 » : le montant tel qu'il a été payé,
                  // pour retrouver sa dépense sur un relevé bancaire.
                  const conv = conversionAffichable(d, devise);
                  return conv ? (
                    <span data-testid="depense-origine" className="block truncate text-[11.5px] text-muted">
                      {format.number(conv.montantSaisiCents / 100, {
                        style: "currency", currency: conv.deviseSaisie, maximumFractionDigits: 2,
                      })}
                      {d.tauxDate ? ` · ${t("tauxDu", { date: jourCourt(d.tauxDate) })}` : ""}
                    </span>
                  ) : null;
                })()}
              </span>
              <span className="shrink-0 text-[13px] tabular-nums text-ink">{euros(d.montantCents)}</span>
              <span className="order-last w-full">
              <PiecesJointes voyageId={voyageId} cible={{ type: "depense", id: d.id }}
                libelleAjout={t("ticketAjouter")}
                documents={tickets.filter((x) => x.depenseId === d.id)
                  .map((x) => ({ id: x.id, nom: x.nom, taille: x.taille }))} />
              </span>
              <button type="button" data-testid="depense-supprimer" aria-label={t("supprimer", { libelle: d.libelle })}
                onClick={() => supprimer(d.id)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-line text-muted focus-visible:outline-2 focus-visible:outline-accent">
                <X size={11} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Soldes et transferts : qui doit quoi à qui */}
      {onglet === "equilibres" && (
      <div data-testid="depenses-soldes" className="flex flex-col gap-1 rounded-card border border-line bg-surface p-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("soldes")}</span>
        <ul className="flex flex-col gap-0.5">
          {soldes.map((s) => (
            <li key={s.participantId} data-testid="solde-row" className="flex items-center justify-between text-[12.5px]">
              <span className="truncate text-ink">{nom(s.participantId)}</span>
              <span className={`tabular-nums ${s.soldeCents > 0 ? "text-kpi-green" : s.soldeCents < 0 ? "text-danger" : "text-muted"}`}>
                {euros(s.soldeCents)}
              </span>
            </li>
          ))}
        </ul>
        {transferts.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1 border-t border-line-soft pt-1.5">
            {transferts.map((tr, i) => (
              <li key={i} data-testid="transfert-row" className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                <span className="min-w-0 flex-1">
                  {t("doit", { de: nom(tr.deParticipantId), vers: nom(tr.versParticipantId), montant: euros(tr.montantCents) })}
                </span>
                {/* Le geste de la maquette : le remboursement proposé se
                    confirme d'un bouton, il ne se ressaisit pas. */}
                <button type="button" data-testid="marquer-rembourse" disabled={enCours}
                  onClick={() => rembourser(tr.deParticipantId, tr.versParticipantId, tr.montantCents)}
                  className="shrink-0 rounded-full border border-line bg-surface-hover px-2.5 py-1 text-[11px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">
                  {t("marquerRembourse")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      {onglet === "depenses" && (!ouvert ? (
        <button type="button" data-testid="depense-ajouter" onClick={() => setOuvert(true)}
          className="inline-flex self-start rounded-full border border-dashed border-accent/40 bg-accent-50 px-3 py-1.5 text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
          + {t("ajouter")}
        </button>
      ) : (
        <form data-testid="depense-form" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            // Le fichier est lu AVANT l'await : après, le formulaire est
            // réinitialisé et l'input vidé (piège du lot V-C).
            const choisi = new FormData(form).get("ticket");
            const ticket = choisi instanceof File && choisi.size > 0 ? choisi : null;
            const cree = await envoyer(form, addDepenseVoyage);
            if (!cree) return;
            setOuvert(false);
            if (ticket) await deposerTicket(ticket, cree);
          }}>
          <input name="libelle" data-testid="depense-libelle" placeholder={t("libelle")} aria-label={t("libelle")}
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
          <div className="flex gap-2">
            <input name="montant" data-testid="depense-montant" inputMode="decimal" placeholder={t("montant")}
              aria-label={t("montant")} value={montantSaisi}
              onChange={(e) => setMontantSaisi(e.target.value)}
              className="w-24 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
            {/* « EUR ▾ » de la maquette : la devise du voyage par défaut, une
                devise locale si on paie ailleurs. */}
            <select name="deviseSaisie" data-testid="depense-devise" aria-label={t("devise")}
              value={deviseSaisie} onChange={(e) => void choisirDevise(e.target.value)}
              className="w-24 rounded-control border border-line bg-surface px-2 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent">
              {DEVISES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select name="payePar" data-testid="depense-paye-par" aria-label={t("payePar", { nom: "" })}
              className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent">
              {participants.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </div>
          {/* « Devise du voyage · saisie possible en devise locale » */}
          <p className="text-[11px] text-muted">{t("deviseAide", { devise })}</p>

          {etrangere && (
            <div data-testid="depense-taux" className="flex flex-col gap-1 rounded-control border border-line bg-surface-hover px-3 py-2">
              {tauxCherche ? (
                <span className="text-[11.5px] text-muted">{t("tauxRecherche")}</span>
              ) : taux != null ? (
                <span className="text-[11.5px] text-muted">
                  {t("tauxLigne", {
                    de: deviseSaisie, vers: devise,
                    valeur: format.number(taux, { maximumFractionDigits: 4 }),
                  })}
                  {tauxDate ? ` · ${t("tauxDu", { date: jourCourt(tauxDate) })}` : ""}
                </span>
              ) : (
                // Aucun taux connu : on le dit et on le demande, plutôt que
                // d'en inventer un qui se propagerait dans tous les soldes.
                <span role="status" className="text-[11.5px] text-kpi-amber">{t("tauxIndisponible")}</span>
              )}
              <label className="flex items-center gap-2 text-[11.5px] text-muted">
                <span className="shrink-0">{t("tauxCorriger", { de: deviseSaisie, vers: devise })}</span>
                <input data-testid="depense-taux-saisi" inputMode="decimal" value={tauxCorrige}
                  onChange={(e) => {
                    setTauxCorrige(e.target.value);
                    const saisi = tauxSaisi(e.target.value);
                    if (saisi != null) { setTaux(saisi); setTauxDate(aujourdhui); }
                  }}
                  placeholder={taux != null ? format.number(taux, { maximumFractionDigits: 4 }) : "0,00"}
                  className="w-24 rounded-control border border-line bg-surface px-2 py-1 text-[12.5px] text-ink outline-none focus:outline-2 focus:outline-accent" />
              </label>
              {/* Ce que ça fera dans les comptes du voyage : la conversion se
                  voit AVANT d'enregistrer, pas après. */}
              {montantCentsVoyage != null && (
                <span data-testid="depense-converti" className="text-[12.5px] font-semibold text-ink">
                  {t("converti", { montant: euros(montantCentsVoyage) })}
                </span>
              )}
              <input type="hidden" name="taux" value={taux ?? ""} />
              <input type="hidden" name="tauxDate" value={tauxDate ?? ""} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <select name="categorie" data-testid="depense-categorie" aria-label={t("categorie")} defaultValue=""
              className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent">
              <option value="">{t("sansCategorie")}</option>
              {CATEGORIES_DEPENSE.map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
            </select>
            {/* « Ticket · Photo » de la maquette : on le prend pendant qu'on a
                le reçu en main, pas dans une seconde visite à la dépense.
                `capture` ouvre l'appareil photo sur mobile ; ailleurs, c'est un
                choix de fichier ordinaire. */}
            <FileField name="ticket" data-testid="depense-ticket" accept="image/*,application/pdf"
              capture="environment" label={t("ticketPhoto")} emptyLabel={t("ticketAucun")}
              className="shrink-0 text-[12.5px]" />
          </div>
          <select name="mode" data-testid="depense-mode" aria-label={t("mode")} value={mode}
            onChange={(e) => setMode(e.target.value as "egal" | "exact")}
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent">
            <option value="egal">{t("modeEgal")}</option>
            <option value="exact">{t("modeExact")}</option>
          </select>

          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("concernes")}</span>
          <ul className="flex flex-col gap-1">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" name="participants" value={p.id}
                  checked={(partages ?? participants.map((x) => x.id)).includes(p.id)}
                  onChange={(e) => setPartages((prev) => {
                    const base = prev ?? participants.map((x) => x.id);
                    return e.target.checked ? [...base, p.id] : base.filter((x) => x !== p.id);
                  })}
                  data-testid={`depense-part-${p.id}`} aria-label={p.displayName} />
                <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
                {mode === "exact" && (
                  <input name={`exact:${p.id}`} inputMode="decimal" placeholder={t("montant")}
                    aria-label={`${t("montant")} ${p.displayName}`}
                    className="w-24 rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
                )}
              </li>
            ))}
          </ul>

          {/* Aide à la saisie de la maquette : ce que ça fait par tête. */}
          {mode === "egal" && (() => {
            const n = (partages ?? participants.map((p) => p.id)).length;
            const part = montantCentsVoyage != null ? parPersonne(montantCentsVoyage, n) : null;
            return part != null ? (
              <p data-testid="depense-par-personne" className="text-[11.5px] text-muted">
                {t("parPersonne", { montant: euros(part), n })}
              </p>
            ) : null;
          })()}

          <div className="flex gap-2">
            <Button type="submit" data-testid="depense-valider" pending={enCours}>{t("valider")}</Button>
            <Button type="button" variant="ghost" onClick={() => setOuvert(false)}>{t("annuler")}</Button>
          </div>
        </form>
      ))}

      {/* Remboursement : ce qui a été rendu de la main à la main */}
      {participants.length > 1 && (
        <form data-testid="remboursement-form" className="flex flex-wrap items-center gap-2 border-t border-line pt-3"
          onSubmit={async (e) => { e.preventDefault(); await envoyer(e.currentTarget, addRemboursementVoyage); }}>
          <select name="deParticipantId" data-testid="remboursement-de" aria-label={t("remboursementDe")}
            className="rounded-control border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink">
            {participants.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
          <span className="text-[12px] text-muted">→</span>
          <select name="versParticipantId" data-testid="remboursement-vers" aria-label={t("remboursementVers")}
            defaultValue={participants[1]?.id}
            className="rounded-control border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink">
            {participants.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
          <input name="montant" data-testid="remboursement-montant" inputMode="decimal" placeholder={t("montant")}
            aria-label={t("montant")}
            className="w-24 rounded-control border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink" />
          <Button type="submit" variant="ghost" data-testid="remboursement-valider" pending={enCours}>
            {t("rembourser")}
          </Button>
        </form>
      )}
    </div>
  );
}
