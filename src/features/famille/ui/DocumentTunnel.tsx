"use client";
import { useActionState, useEffect, useState, startTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { Camera, FileUp, Plus } from "lucide-react";
import { creerDocument } from "../data/actions";
import { DOC_TYPES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { EMPTY_FIELDS, type OcrFields } from "@/lib/services/ocr";
import { Input } from "@/features/shared/ui/Input";

const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
const MAX = 10 * 1024 * 1024;

type Step = "A" | "B" | "C" | "D";

// Tunnel d'ajout de document — 4 étapes + OCR conservés (décision PO), restylé
// design Onglet_Cercle (écran 5) : chips de type (+ type libre), segments de
// progression, verso optionnel à la vérification, CTA plein pied.
export function DocumentTunnel({ memberId }: { memberId: string }) {
  const t = useTranslations("famille");
  const [step, setStep] = useState<Step>("A");
  const [docType, setDocType] = useState<string>("passeport");
  const [docLabel, setDocLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [verso, setVerso] = useState<File | null>(null);
  const [versoError, setVersoError] = useState(false);
  const [fields, setFields] = useState<OcrFields>(EMPTY_FIELDS);
  const [ocrRaw, setOcrRaw] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [readError, setReadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [uploadError, setUploadError] = useState<{ name: string; size: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch, pending] = useActionState(creerDocument, undefined);
  const stepN = { A: 1, B: 2, C: 3, D: 4 }[step];

  function pick(f: File) {
    if (!ALLOWED.includes(f.type) || f.size <= 0 || f.size > MAX) { setUploadError({ name: f.name, size: f.size }); return; }
    setUploadError(null); setFile(f); setStep("C");
  }

  function pickVerso(f: File) {
    if (!ALLOWED.includes(f.type) || f.size <= 0 || f.size > MAX) { setVersoError(true); setVerso(null); return; }
    setVersoError(false); setVerso(f);
  }

  // Étape C : lecture OCR (la route ne persiste rien). Échec → bloc d'erreur à l'étape C.
  useEffect(() => {
    if (step !== "C" || !file) return;
    let cancelled = false;
    (async () => {
      try {
        const fd = new FormData(); fd.set("file", file); fd.set("docType", docType);
        const resp = await fetch("/api/famille/documents/read", { method: "POST", body: fd });
        if (!resp.ok) throw new Error();
        const body = await resp.json();
        if (cancelled) return;
        setFields({ ...EMPTY_FIELDS, ...body.fields }); setOcrRaw(JSON.stringify(body.raw ?? null)); setManual(false);
        setStep("D");
      } catch {
        if (cancelled) return;
        setReadError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [step, file, docType, attempt]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData(e.currentTarget);
    fd.set("memberId", memberId); fd.set("docType", docType); fd.set("file", file);
    if (docType === "autre" && docLabel.trim()) fd.set("doc_label", docLabel.trim());
    if (verso) fd.set("file_verso", verso);
    if (ocrRaw) fd.set("ocrRaw", ocrRaw);
    startTransition(() => dispatch(fd));
  }

  return (
    <div data-testid="document-tunnel" className="flex max-w-md flex-col gap-4">
      <div className="text-sm text-muted">{t("tunnel.titre")} · {t("tunnel.stepOf", { n: stepN })}</div>
      {/* segments de progression (mobile) + stepper libellé (desktop, e2e « Vérification ») */}
      <div className="flex gap-1.5 lg:hidden" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`h-[3px] flex-1 rounded-full ${n <= stepN ? "bg-accent" : "bg-line"}`} />
        ))}
      </div>
      <StepIndicator step={step} t={t} />

      {step === "A" && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl text-ink">{t("tunnel.aTitre")}</h2>
          <p className="text-muted">{t("tunnel.aSous")}</p>
          <div className="flex flex-wrap gap-2">
            {DOC_TYPES.filter((dt) => dt !== "autre").map((dt) => (
              <button key={dt} type="button" onClick={() => setDocType(dt)} aria-pressed={docType === dt}
                className={`rounded-full px-3.5 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  docType === dt ? "bg-ink font-semibold text-app" : "border border-line bg-surface text-muted hover:bg-surface-hover"
                }`}>
                {t(`docTypes.${dt}`)}
              </button>
            ))}
            <button type="button" onClick={() => setDocType("autre")} aria-pressed={docType === "autre"}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                docType === "autre" ? "bg-ink font-semibold text-app" : "border border-dashed border-accent/40 bg-accent-50 text-accent"
              }`}>
              <Plus size={11} aria-hidden />
              {t("tunnel.autreType")}
            </button>
          </div>
          {docType === "autre" && (
            <Input label={t("tunnel.autreTypeNom")} value={docLabel} onChange={(e) => setDocLabel(e.target.value)} name="doc_label_saisie" />
          )}
          <Button onClick={() => setStep("B")} disabled={docType === "autre" && !docLabel.trim()}>{t("tunnel.continuer")}</Button>
        </div>
      )}

      {step === "B" && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl text-ink">{t("tunnel.bTitre")}</h2>
          {uploadError && (
            <div role="alert" className="rounded-card border border-danger bg-danger-bg p-3 text-sm text-danger">
              <div className="font-semibold">{t("tunnel.bErreurTitre")}</div>
              <div>{uploadError.name} · {(uploadError.size / 1048576).toFixed(1)} Mo · {t("tunnel.bNonSupporte")}</div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setUploadError(null)}
                  className="rounded-control border border-danger px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent">
                  {t("tunnel.bReessayer")}
                </button>
                <button type="button" onClick={() => inputRef.current?.click()}
                  className="rounded-control border border-danger px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent">
                  {t("tunnel.bAutreFichier")}
                </button>
              </div>
            </div>
          )}
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-[6px] border border-dashed border-line bg-surface-hover p-7 text-center">
            <Camera size={22} className="mb-1 text-faint" aria-hidden />
            <span className="text-ink">{t("tunnel.bDepose")}</span>
            <span className="text-sm text-muted">{t("tunnel.bOu")}</span>
            <span className="text-xs text-muted">{t("tunnel.bContraintes")}</span>
            <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              data-testid="tunnel-file" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
            <span className="mt-2 inline-flex gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink"><Camera size={13} aria-hidden />{t("tunnel.bPhoto")}</span>
              <span className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink"><FileUp size={13} aria-hidden />{t("tunnel.bImporter")}</span>
            </span>
          </label>
        </div>
      )}

      {step === "C" && (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          {readError ? (
            <div role="alert" className="flex flex-col items-center gap-3">
              <h2 className="font-serif text-2xl text-ink">{t("tunnel.cErreurTitre")}</h2>
              <div className="flex gap-2">
                <Button onClick={() => { setReadError(false); setAttempt((a) => a + 1); }}>{t("tunnel.cReessayer")}</Button>
                <Button variant="ghost" onClick={() => { setManual(true); setFields(EMPTY_FIELDS); setReadError(false); setStep("D"); }}>{t("tunnel.cManuel")}</Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-2xl text-ink">{t("tunnel.cTitre")}</h2>
              <p className="text-muted">{t("tunnel.cSous")}</p>
            </>
          )}
        </div>
      )}

      {step === "D" && (
        <form onSubmit={submit} data-testid="tunnel-verify" className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl text-ink">{t("tunnel.dTitre")}</h2>
          {manual && <p role="status" className="text-sm text-muted">{t("tunnel.dSaisieManuelle")}</p>}
          <Field name="doc_number" label={t("tunnel.dNumero")} def={fields.doc_number} auto={!manual && !!fields.doc_number} t={t} />
          <Field name="country" label={t("tunnel.dPays")} def={fields.country} auto={!manual && !!fields.country} t={t} />
          <Field name="holder_name" label={t("tunnel.dTitulaire")} def={fields.holder_name} auto={!manual && !!fields.holder_name} t={t} />
          <Field name="issue_date" label={t("tunnel.dEmission")} def={fields.issue_date} auto={!manual && !!fields.issue_date} t={t} type="date" />
          <Field name="expiry_date" label={t("tunnel.dExpiration")} def={fields.expiry_date} auto={!manual && !!fields.expiry_date} t={t} type="date" />
          <Field name="issue_place" label={t("tunnel.dLieu")} def={fields.issue_place} auto={!manual && !!fields.issue_place} t={t} />

          {/* verso optionnel (design : recto puis verso) — hors OCR, simple seconde face */}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[6px] border border-dashed border-line bg-surface-hover px-3.5 py-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-ink">{t("tunnel.versoOptionnel")}</span>
              <span className="text-xs text-muted">{verso ? verso.name : t("tunnel.bContraintes")}</span>
              {versoError && <span role="alert" className="text-xs text-danger">{t("tunnel.bNonSupporte")}</span>}
            </span>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              data-testid="tunnel-verso" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickVerso(f); }} />
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${verso ? "border border-current/20 bg-kpi-green-bg text-kpi-green" : "border border-line bg-surface text-muted"}`}>
              {verso ? `${t("doc.verso")} ✓` : t("doc.verso")}
            </span>
          </label>

          {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
          <Button type="submit" pending={pending} className="w-full py-3.5 shadow-[0_6px_18px_rgba(37,99,235,.3)]">{t("tunnel.dEnregistrer")}</Button>
        </form>
      )}
    </div>
  );
}

function StepIndicator({ step, t }: { step: "A" | "B" | "C" | "D"; t: ReturnType<typeof useTranslations> }) {
  const steps = [
    { k: "A", label: t("tunnel.steps.type") },
    { k: "B", label: t("tunnel.steps.document") },
    { k: "C", label: t("tunnel.steps.lecture") },
    { k: "D", label: t("tunnel.steps.verification") },
  ];
  const currentIdx = steps.findIndex((s) => s.k === step);
  return (
    <ol className="hidden lg:flex items-center gap-2" aria-hidden="true">
      {steps.map((s, i) => (
        <li key={s.k} className="flex items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${i <= currentIdx ? "bg-accent text-white" : "bg-accent-50 text-accent"}`}>{i + 1}</span>
          <span className={`text-sm ${i === currentIdx ? "text-ink font-medium" : "text-muted"}`}>{s.label}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line" />}
        </li>
      ))}
    </ol>
  );
}

function Field({ name, label, def, auto, type = "text", t }: {
  name: string; label: string; def: string | null; auto: boolean; type?: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-2 text-sm text-muted">
        {label}
        <span className="text-xs text-accent">{auto ? t("tunnel.dLuAuto") : t("tunnel.dAVerifier")}</span>
      </span>
      <Input name={name} type={type} defaultValue={def ?? ""} />
    </label>
  );
}
