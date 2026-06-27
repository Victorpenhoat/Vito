"use client";
import { useActionState, useEffect, useState, startTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { creerDocument } from "../data/actions";
import { DOC_TYPES } from "../domain/schemas";
import { DocTypeIcon } from "./DocTypeIcon";
import { Button } from "@/features/shared/ui/Button";
import { EMPTY_FIELDS, type OcrFields } from "@/lib/services/ocr";

const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
const MAX = 10 * 1024 * 1024;
const FIELD = "rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent";

type Step = "A" | "B" | "C" | "D";

export function DocumentTunnel({ memberId }: { memberId: string }) {
  const t = useTranslations("famille");
  const [step, setStep] = useState<Step>("A");
  const [docType, setDocType] = useState<string>("passeport");
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<OcrFields>(EMPTY_FIELDS);
  const [ocrRaw, setOcrRaw] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [uploadError, setUploadError] = useState<{ name: string; size: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch, pending] = useActionState(creerDocument, undefined);
  const stepN = { A: 1, B: 2, C: 3, D: 4 }[step];

  function pick(f: File) {
    if (!ALLOWED.includes(f.type) || f.size <= 0 || f.size > MAX) { setUploadError({ name: f.name, size: f.size }); return; }
    setUploadError(null); setFile(f); setStep("C");
  }

  // Étape C : lecture OCR (la route ne persiste rien). Échec → fallback manuel en D.
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
      } catch {
        if (cancelled) return;
        setFields(EMPTY_FIELDS); setOcrRaw(null); setManual(true);
      } finally {
        if (!cancelled) setStep("D");
      }
    })();
    return () => { cancelled = true; };
  }, [step, file, docType]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData(e.currentTarget);
    fd.set("memberId", memberId); fd.set("docType", docType); fd.set("file", file);
    if (ocrRaw) fd.set("ocrRaw", ocrRaw);
    startTransition(() => dispatch(fd));
  }

  return (
    <div data-testid="document-tunnel" className="flex max-w-md flex-col gap-4">
      <div className="text-sm text-muted">{t("tunnel.titre")} · {t("tunnel.stepOf", { n: stepN })}</div>

      {step === "A" && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl text-ink">{t("tunnel.aTitre")}</h2>
          <p className="text-muted">{t("tunnel.aSous")}</p>
          <ul className="grid grid-cols-2 gap-2">
            {DOC_TYPES.map((dt) => (
              <li key={dt}>
                <button type="button" onClick={() => setDocType(dt)}
                  className={`flex w-full items-center gap-2 rounded-card border p-3 text-left ${docType === dt ? "border-accent" : "border-line"}`}>
                  <DocTypeIcon docType={dt} /><span className="text-sm text-ink">{t(`docTypes.${dt}`)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button onClick={() => setStep("B")}>{t("tunnel.continuer")}</Button>
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
                  className="rounded-control border border-danger px-3 py-1.5 text-xs font-medium">
                  {t("tunnel.bReessayer")}
                </button>
                <button type="button" onClick={() => inputRef.current?.click()}
                  className="rounded-control border border-danger px-3 py-1.5 text-xs font-medium">
                  {t("tunnel.bAutreFichier")}
                </button>
              </div>
            </div>
          )}
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-card border border-dashed border-line p-6 text-center">
            <span className="text-ink">{t("tunnel.bDepose")}</span>
            <span className="text-sm text-muted">{t("tunnel.bOu")}</span>
            <span className="text-xs text-muted">{t("tunnel.bContraintes")}</span>
            <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              data-testid="tunnel-file" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
            <span className="mt-2 inline-flex gap-2">
              <span className="rounded-control border border-line px-3 py-1.5 text-sm">{t("tunnel.bPhoto")}</span>
              <span className="rounded-control border border-line px-3 py-1.5 text-sm">{t("tunnel.bImporter")}</span>
            </span>
          </label>
        </div>
      )}

      {step === "C" && (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <h2 className="font-serif text-2xl text-ink">{t("tunnel.cTitre")}</h2>
          <p className="text-muted">{t("tunnel.cSous")}</p>
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
          {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
          <Button type="submit" pending={pending}>{t("tunnel.dEnregistrer")}</Button>
        </form>
      )}
    </div>
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
      <input name={name} type={type} defaultValue={def ?? ""} className={FIELD} />
    </label>
  );
}
