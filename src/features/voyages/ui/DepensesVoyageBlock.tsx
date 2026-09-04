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
import { Button } from "@/features/shared/ui/Button";

type DepenseAffichee = DepenseVoyage & { libelle: string; date: string | null };

// Dépenses du voyage (Lot D) : le partage entre VOYAGEURS, y compris ceux qui
// n'ont pas de compte. Sans voyageur, il n'y a personne entre qui partager —
// le bloc invite alors à en ajouter plutôt que d'afficher un formulaire mort.
export function DepensesVoyageBlock({
  voyageId, participants, depenses, remboursements, devise,
}: {
  voyageId: string;
  participants: Participant[];
  depenses: DepenseAffichee[];
  remboursements: (RemboursementVoyage & { id: string })[];
  devise: string;
}) {
  const t = useTranslations("voyages.depensesVoyage");
  const format = useFormatter();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<"egal" | "exact">("egal");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [supprimees, setSupprimees] = useState<string[]>([]);

  const visibles = depenses.filter((d) => !supprimees.includes(d.id));
  const nom = (id: string) => participants.find((p) => p.id === id)?.displayName ?? "—";
  const euros = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: devise, maximumFractionDigits: 2 });

  const soldes = soldesParticipants(participants.map((p) => p.id), visibles, remboursements);
  const transferts = transfertsSimplifies(soldes);

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
      return false;
    }
    form.reset();
    // Les soldes se recalculent à partir des données du serveur : ici, pas
    // d'affichage optimiste possible sans dupliquer le calcul — on demande donc
    // un rendu frais, et l'écran attend d'avoir la vérité pour l'afficher.
    router.refresh();
    return true;
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
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-muted">{t("total")}</span>
        <span data-testid="depenses-total" className="font-serif text-xl text-ink">{euros(totalDepenses(visibles))}</span>
      </div>

      {erreur && <p role="alert" className="text-[12px] text-danger">{erreur}</p>}

      {visibles.length > 0 && (
        <ul className="flex flex-col">
          {visibles.map((d) => (
            <li key={d.id} data-testid="depense-row" className="flex items-center gap-2 border-b border-line-soft py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">{d.libelle}</span>
                <span className="block truncate text-[11.5px] text-muted">
                  {t("payePar", { nom: nom(d.payePar) })} · {t("partsCount", { n: d.parts.length })}
                </span>
              </span>
              <span className="shrink-0 text-[13px] tabular-nums text-ink">{euros(d.montantCents)}</span>
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
          <ul className="mt-1.5 flex flex-col gap-0.5 border-t border-line-soft pt-1.5">
            {transferts.map((tr, i) => (
              <li key={i} data-testid="transfert-row" className="text-[12px] text-muted">
                {t("doit", { de: nom(tr.deParticipantId), vers: nom(tr.versParticipantId), montant: euros(tr.montantCents) })}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!ouvert ? (
        <button type="button" data-testid="depense-ajouter" onClick={() => setOuvert(true)}
          className="inline-flex self-start rounded-full border border-dashed border-accent/40 bg-accent-50 px-3 py-1.5 text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
          + {t("ajouter")}
        </button>
      ) : (
        <form data-testid="depense-form" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await envoyer(e.currentTarget, addDepenseVoyage)) setOuvert(false);
          }}>
          <input name="libelle" data-testid="depense-libelle" placeholder={t("libelle")} aria-label={t("libelle")}
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
          <div className="flex gap-2">
            <input name="montant" data-testid="depense-montant" inputMode="decimal" placeholder={t("montant")}
              aria-label={t("montant")}
              className="w-28 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
            <select name="payePar" data-testid="depense-paye-par" aria-label={t("payePar", { nom: "" })}
              className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent">
              {participants.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
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
                <input type="checkbox" name="participants" value={p.id} defaultChecked
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

          <div className="flex gap-2">
            <Button type="submit" data-testid="depense-valider" pending={enCours}>{t("valider")}</Button>
            <Button type="button" variant="ghost" onClick={() => setOuvert(false)}>{t("annuler")}</Button>
          </div>
        </form>
      )}

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
