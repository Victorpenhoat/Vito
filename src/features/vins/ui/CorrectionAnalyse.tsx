"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, RefreshCw, X } from "lucide-react";
import { corrigerVin, relancerAnalyse } from "../data/actions";
import { VIN_COULEURS } from "../domain/schemas";
import { Modal } from "@/features/shared/ui/Modal";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

export type CorrectionVin = {
  id: string;
  domaine: string | null;
  cuvee: string | null;
  appellation: string | null;
  region: string | null;
  millesime: number | null;
  degre: number | null;
  couleur: string | null;
  cepages: string[];
};

// Correction d'analyse (design Vins & Cave écran 9). La fiche est générée : on
// corrige le champ qui cloche, puis on peut relancer l'analyse AVEC ces
// corrections — c'est ce que dit le bouton, et c'est ce que fait l'action.
export function CorrigerButton({ vin }: { vin: CorrectionVin }) {
  const t = useTranslations("vins");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="corriger-analyse"
        className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-accent hover:underline">
        <Pencil size={11} aria-hidden />{t("analyse.corriger")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("analyse.corrigerTitre")}>
        <CorrectionForm vin={vin} onFini={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function CorrectionForm({ vin, onFini }: { vin: CorrectionVin; onFini: () => void }) {
  const t = useTranslations("vins");
  const [state, action, pending] = useActionState(corrigerVin, undefined);
  const [relance, relancer, relancePending] = useActionState(relancerAnalyse, undefined);
  const [cepages, setCepages] = useState<string[]>(vin.cepages ?? []);
  const [saisie, setSaisie] = useState("");

  const ajouterCepage = () => {
    const c = saisie.trim();
    if (c && !cepages.includes(c)) setCepages((l) => [...l, c]);
    setSaisie("");
  };

  return (
    <div className="flex flex-col gap-3">
      <form action={action} data-testid="correction-form" className="flex flex-col gap-2.5">
        <input type="hidden" name="vinId" value={vin.id} />
        <Champ label={t("domaine")} name="domaine" defaultValue={vin.domaine ?? ""} />
        <Champ label={t("etiquette.cuvee")} name="cuvee" defaultValue={vin.cuvee ?? ""} />
        <Champ label={t("appellation")} name="appellation" defaultValue={vin.appellation ?? ""} />
        <Champ label={t("region")} name="region" defaultValue={vin.region ?? ""} />
        <div className="flex flex-wrap gap-2">
          <Champ label={t("millesime")} name="millesime" type="number" min={1900} max={2100}
            defaultValue={vin.millesime != null ? String(vin.millesime) : ""} className="w-28" />
          <Champ label={t("degre")} name="degre" type="number" step="0.1" min={0} max={25}
            defaultValue={vin.degre != null ? String(vin.degre) : ""} className="w-28" />
          <label className="flex flex-col gap-1 text-[11px] text-muted">
            {t("couleur")}
            <Select name="couleur" defaultValue={vin.couleur ?? ""}>
              <option value="">—</option>
              {VIN_COULEURS.map((c) => <option key={c} value={c}>{t(`couleurs.${c}`)}</option>)}
            </Select>
          </label>
        </div>

        <div className="flex flex-col gap-1 text-[11px] text-muted">
          {t("cepagesLabel")}
          <div className="flex flex-wrap items-center gap-1.5">
            {cepages.map((c) => (
              <span key={c} data-testid="cepage-chip"
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-hover px-2.5 py-1 text-[11.5px] text-ink">
                {c}
                <button type="button" aria-label={t("retirerCepage", { cepage: c })}
                  onClick={() => setCepages((l) => l.filter((x) => x !== c))}>
                  <X size={11} aria-hidden />
                </button>
              </span>
            ))}
            <input value={saisie} onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterCepage(); } }}
              data-testid="cepage-saisie" placeholder={t("ajouterCepage")}
              className="w-32 rounded-full border border-dashed border-line bg-surface px-2.5 py-1 text-[11.5px] text-ink outline-none focus:outline-2 focus:outline-accent" />
          </div>
          {/* Les cépages partent en une seule valeur, comme partout ailleurs. */}
          <input type="hidden" name="cepages" value={cepages.join(", ")} />
        </div>

        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" pending={pending} data-testid="enregistrer-correction">{t("analyse.enregistrerCorrection")}</Button>
      </form>

      <form action={relancer} className="border-t border-line-soft pt-3">
        <input type="hidden" name="vinId" value={vin.id} />
        {relance?.error && <p role="alert" className="mb-1.5 text-sm text-danger">{relance.error}</p>}
        <button type="submit" disabled={relancePending} data-testid="relancer-analyse"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:underline disabled:opacity-60">
          <RefreshCw size={12} aria-hidden />
          {relancePending ? t("analyse.relanceEnCours") : t("analyse.relancer")}
        </button>
        <p className="mt-1 text-[11px] text-faint">{t("analyse.relancerAide")}</p>
      </form>

      {(state?.ok || relance?.ok) && (
        <button type="button" onClick={onFini} data-testid="fermer-correction"
          className="self-end text-[11.5px] font-semibold text-muted hover:text-ink">
          {t("analyse.fermer")}
        </button>
      )}
    </div>
  );
}

function Champ({ label, className, ...props }: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <label className={`flex flex-col gap-1 text-[11px] text-muted ${className ?? ""}`}>
      {label}
      {/* testid distinct de ceux du tunnel de capture : les deux écrans portent
          les mêmes champs, et une correction n'est pas une lecture d'étiquette. */}
      <Input {...props} data-testid={`correction-${props.name}`} />
    </label>
  );
}
