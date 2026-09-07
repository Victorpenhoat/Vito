"use client";
import { useActionState, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Modal } from "@/features/shared/ui/Modal";
import { Button } from "@/features/shared/ui/Button";
import { FileField } from "@/features/shared/ui/FileField";
import { ajouterDocumentActivite, ouvrirDocumentActivite } from "../data/actionsProtegees";
import { etatValidite, joursAvant } from "../domain/protege";

const TYPES = ["licence", "certificat_medical", "assurance", "autorisation", "reglement", "facture", "autre"] as const;

const TEINTE: Record<string, string> = {
  expire: "border-danger/30 bg-danger-bg text-danger",
  bientot: "border-current/20 bg-kpi-amber-bg text-kpi-amber",
  valide: "border-kpi-green/30 bg-kpi-green-bg text-kpi-green",
};

type Doc = { id: string; type: string; nom: string; sensible: boolean; taille: number; expireLe: string | null };

/**
 * Licences, certificats médicaux, attestations d'assurance.
 *
 * Le contenu ne voyage jamais avec la page : l'ouverture demande le mot de
 * passe, obtient un ticket à usage unique, et la route de lecture l'exige. Même
 * mécanique que les scans d'identité du Cercle.
 */
export function SectionDocuments({ activiteId, documents, aujourdhui }: {
  activiteId: string; documents: Doc[]; aujourdhui: string;
}) {
  const t = useTranslations("activites");
  const tp = useTranslations("protege");
  const format = useFormatter();
  const router = useRouter();
  const [ouvertForm, setOuvertForm] = useState(false);
  const [aOuvrir, setAOuvrir] = useState<Doc | null>(null);

  const [ajout, actionAjout, enAjout] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const res = await ajouterDocumentActivite(prev, fd);
      if ("ok" in res && res.ok) { setOuvertForm(false); router.refresh(); }
      return res;
    },
    undefined,
  );

  const [acces, actionAcces, enAcces] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const res = await ouvrirDocumentActivite(prev, fd);
      if ("ok" in res && res.ok && aOuvrir) {
        // Le ticket ne sert qu'une fois : on ouvre immédiatement, dans un
        // onglet, et il est consommé à la première lecture.
        window.open(`/api/activites/documents/${aOuvrir.id}?ticket=${res.ticket}`, "_blank", "noopener");
        setAOuvrir(null);
      }
      return res;
    },
    undefined,
  );

  const champ = "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent";
  const dateCourte = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <section data-testid="section-documents" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("sections.documents")}</h2>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-kpi-green">
          <ShieldCheck size={11} aria-hidden />
          {tp("chaqueRevelation")}
        </span>
      </header>

      {documents.length === 0 ? (
        <p className="text-[12.5px] text-muted">{t("documents.aucun")}</p>
      ) : (
        <ul className="flex flex-col">
          {documents.map((d) => {
            const etat = etatValidite(d.expireLe, aujourdhui);
            return (
              <li key={d.id} data-testid="document-activite" className="flex flex-wrap items-center gap-2 border-b border-line-soft py-2 last:border-b-0">
                <FileText size={13} className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{t(`documents.types.${d.type}`)}</span>
                {etat && (
                  <span data-testid="document-validite"
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${TEINTE[etat]}`}>
                    {etat === "expire"
                      ? t("documents.expire", { date: dateCourte(d.expireLe!) })
                      : etat === "bientot"
                        ? t("documents.bientot", { n: joursAvant(d.expireLe!, aujourdhui) })
                        : t("documents.valide", { date: dateCourte(d.expireLe!) })}
                  </span>
                )}
                <button type="button" data-testid="document-ouvrir" onClick={() => setAOuvrir(d)}
                  className="shrink-0 text-[11.5px] font-semibold text-accent hover:underline">
                  {tp("afficherDocument")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!ouvertForm ? (
        <button type="button" data-testid="document-ajouter" onClick={() => setOuvertForm(true)}
          className="self-start text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
          + {t("documents.ajouter")}
        </button>
      ) : (
        <form action={actionAjout} data-testid="document-form" className="flex flex-col gap-2 rounded-control border border-line bg-surface-hover p-3">
          <input type="hidden" name="activiteId" value={activiteId} />
          <select name="type" data-testid="document-type" aria-label={t("documents.type")} defaultValue="licence" className={champ}>
            {TYPES.map((ty) => <option key={ty} value={ty}>{t(`documents.types.${ty}`)}</option>)}
          </select>
          <label className="flex flex-col gap-1 text-[11.5px] text-muted">
            {t("documents.expireLe")}
            <input type="date" name="expireLe" data-testid="document-expire" className={champ} />
          </label>
          <FileField name="file" data-testid="document-fichier" accept="image/*,application/pdf"
            label={t("documents.choisir")} emptyLabel={t("documents.aucunFichier")} />
          {ajout && "error" in ajout && ajout.error && (
            <p role="alert" className="text-[12px] text-danger">{ajout.error}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" pending={enAjout} data-testid="document-valider">{t("documents.enregistrer")}</Button>
            <button type="button" onClick={() => setOuvertForm(false)} className="text-[12.5px] text-muted hover:text-ink">
              {t("annuler")}
            </button>
          </div>
        </form>
      )}

      <Modal open={aOuvrir !== null} onClose={() => setAOuvrir(null)} title={tp("confirmer.titre")}>
        <form action={actionAcces} data-testid="document-reauth" className="flex flex-col gap-3">
          <input type="hidden" name="id" value={aOuvrir?.id ?? ""} />
          <p className="text-[13px] text-muted">{tp("confirmer.pourquoi")}</p>
          <input type="password" name="motDePasse" autoComplete="current-password"
            data-testid="document-mot-de-passe" aria-label={tp("confirmer.motDePasse")}
            placeholder={tp("confirmer.motDePasse")} className={champ} />
          {acces && "error" in acces && acces.error && (
            <p role="alert" className="text-[12.5px] text-danger">{acces.error}</p>
          )}
          <Button type="submit" pending={enAcces} data-testid="document-reauth-valider">{tp("confirmer.verifier")}</Button>
        </form>
      </Modal>
    </section>
  );
}
