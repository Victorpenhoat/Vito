"use client";
import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useTranslations } from "next-intl";
import { Camera, FileUp, Pencil } from "lucide-react";
import { useRouter } from "@/lib/i18n/routing";
import { creerVinDepuisEtiquette } from "../data/actions";
import { VIN_COULEURS } from "../domain/schemas";
import { aConfirmer, nomDepuisEtiquette } from "../domain/etiquette";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";
import type { LabelAnalyse, LabelConfiance, LabelFields } from "@/lib/services/vin-label/types";
import { EMPTY_LABEL_FIELDS } from "@/lib/services/vin-label/types";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX = 10 * 1024 * 1024;

type Etape = "choix" | "lecture" | "champs";
type VinConnu = { id: string; nb: number; dernier: string | null };

// Capture d'étiquette (design Vins & Cave, écrans 2 et 11) : photo → lecture par
// le modèle → champs reconnus TOUS éditables, chacun avec son niveau de
// confiance. Aucune donnée générée n'est présentée comme sûre ; en cas d'échec,
// « Réessayer » ou « Saisir manuellement » (même UX que le tunnel documents).
export function EtiquetteTunnel({ vinsConnus = [], onCree }: {
  vinsConnus?: { id: string; cle: string; nb: number; dernier: string | null }[];
  onCree?: (vinId: string) => void;
}) {
  const t = useTranslations("vins");
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>("choix");
  const [photo, setPhoto] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [fields, setFields] = useState<LabelFields>(EMPTY_LABEL_FIELDS);
  const [confiance, setConfiance] = useState<LabelConfiance>({});
  const [analyse, setAnalyse] = useState<LabelAnalyse | null>(null);
  const [modele, setModele] = useState<string | null>(null);
  const [illisible, setIllisible] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);
  const [hint, setHint] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch, pending] = useActionState(creerVinDepuisEtiquette, undefined);

  // Lecture de l'étiquette : la route n'enregistre rien, elle analyse seulement.
  useEffect(() => {
    if (etape !== "lecture") return;
    let annule = false;
    (async () => {
      try {
        const fd = new FormData();
        if (photo) fd.set("file", photo);
        if (!photo && hint.trim()) fd.set("hint", hint.trim());
        const resp = await fetch("/api/vins/etiquette/read", { method: "POST", body: fd });
        if (!resp.ok) throw new Error("lecture");
        const body = await resp.json();
        if (annule) return;
        setFields({ ...EMPTY_LABEL_FIELDS, ...body.fields });
        setConfiance(body.confiance ?? {});
        setAnalyse(body.analyse ?? null);
        setModele(body.modele ?? null);
        setIllisible(body.illisible === true);
        setErreur(null);
        setEtape("champs");
      } catch {
        if (annule) return;
        setErreur(t("etiquette.erreurLecture"));
        setEtape("champs");
        setIllisible(true);
      }
    })();
    return () => { annule = true; };
  }, [etape, photo, hint, essai, t]);

  useEffect(() => {
    if (state?.ok && state.vinId) {
      if (onCree) onCree(state.vinId);
      else router.push(`/vins/${state.vinId}`);
    }
  }, [state, onCree, router]);

  function choisir(f: File) {
    if (!ALLOWED.includes(f.type) || f.size <= 0 || f.size > MAX) { setErreur(t("etiquette.fichierInvalide")); return; }
    setErreur(null);
    setPhoto(f);
    // Aperçu local créé dans le handler (jamais dans un effet : setState-in-effect
    // est proscrit ici). L'URL précédente est révoquée pour ne pas fuiter.
    setApercu((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setEtape("lecture");
  }

  const nom = nomDepuisEtiquette(fields) ?? "";
  // « Vous avez déjà bu ce vin » : même clé de dédoublonnage que la base.
  const cle = `${nom.trim().toLowerCase()}|${fields.millesime ?? 0}|${(fields.domaine ?? "").trim().toLowerCase()}`;
  const connu: VinConnu | null = (() => {
    const v = vinsConnus.find((x) => x.cle === cle);
    return v ? { id: v.id, nb: v.nb, dernier: v.dernier } : null;
  })();

  function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (photo) fd.set("etiquette", photo);
    if (analyse) fd.set("analyse", JSON.stringify(analyse));
    if (Object.keys(confiance).length > 0) fd.set("confiance", JSON.stringify(confiance));
    if (modele) fd.set("modele", modele);
    startTransition(() => dispatch(fd));
  }

  const badge = (champ: keyof LabelFields) => {
    const niveau = confiance[champ];
    if (!niveau) return null;
    const ton = niveau === "sur" ? "border-current/20 bg-kpi-green-bg text-kpi-green"
      : niveau === "probable" ? "border-line bg-surface-hover text-muted"
      : "border-current/20 bg-kpi-amber-bg text-kpi-amber";
    return (
      <span data-testid={`confiance-${champ}`} className={`rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${ton}`}>
        {t(`etiquette.confiance.${niveau}`)}
      </span>
    );
  };

  return (
    <div data-testid="etiquette-tunnel" className="flex flex-col gap-4">
      {etape === "choix" && (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm text-muted">{t("etiquette.cadrer")}</p>
          <input ref={inputRef} type="file" accept={ALLOWED.join(",")} capture="environment" className="hidden"
            data-testid="etiquette-input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) choisir(f); }} />
          <Button type="button" data-testid="etiquette-photo" onClick={() => inputRef.current?.click()}>
            <Camera size={15} aria-hidden /> {t("etiquette.photographier")}
          </Button>
          <button type="button" data-testid="etiquette-photothèque" onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-control border border-line bg-surface py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent">
            <FileUp size={15} aria-hidden /> {t("etiquette.phototheque")}
          </button>
          <div className="flex items-center gap-2">
            <Input value={hint} onChange={(e) => setHint(e.target.value)} data-testid="etiquette-hint"
              placeholder={t("etiquette.sansPhotoPlaceholder")} aria-label={t("etiquette.sansPhotoPlaceholder")} className="flex-1 text-sm" />
            <button type="button" data-testid="etiquette-manuelle" disabled={!hint.trim()}
              onClick={() => { setPhoto(null); setEtape("lecture"); }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2.5 text-xs font-semibold text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent">
              <Pencil size={13} aria-hidden /> {t("etiquette.chercher")}
            </button>
          </div>
          {erreur && <p role="alert" className="text-sm text-danger">{erreur}</p>}
        </div>
      )}

      {etape === "lecture" && (
        <div data-testid="etiquette-lecture" className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
          <p className="text-sm text-muted">{t("etiquette.lectureEnCours")}</p>
        </div>
      )}

      {etape === "champs" && (
        <form onSubmit={envoyer} data-testid="etiquette-form" className="flex flex-col gap-3.5">
          {apercu && (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (objectURL), jamais distant
            <img src={apercu} alt="" className="h-40 w-full rounded-card object-cover" />
          )}

          {illisible ? (
            <div data-testid="etiquette-illisible" className="rounded-[5px] border border-current/20 bg-kpi-amber-bg px-3.5 py-3">
              <p className="text-[13px] font-semibold text-kpi-amber">{t("etiquette.illisibleTitre")}</p>
              <p className="mt-1 text-[12.5px] text-ink">{t("etiquette.illisibleTexte")}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" data-testid="etiquette-reessayer" onClick={() => { setEssai((n) => n + 1); setEtape("lecture"); }}
                  className="rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
                  {t("etiquette.reessayer")}
                </button>
                <span className="self-center text-[11px] text-muted">{t("etiquette.ouSaisir")}</span>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-muted">{t("etiquette.verifiez")}</p>
          )}

          {connu && (
            <div data-testid="vin-deja-bu" className="rounded-[5px] border border-accent/25 bg-accent-50 px-3.5 py-2.5 text-[12.5px] text-ink">
              {t("etiquette.dejaBu", { n: connu.nb })}
              {connu.dernier ? ` — ${t("etiquette.dernierLieu", { lieu: connu.dernier })}` : ""}
            </div>
          )}

          {/* champs reconnus — tous éditables, chacun avec sa confiance */}
          <input type="hidden" name="nom" value={nom} />
          <Champ label={t("etiquette.domaine")} name="domaine" value={fields.domaine ?? ""} badge={badge("domaine")}
            onChange={(v) => setFields((f) => ({ ...f, domaine: v || null }))} />
          <Champ label={t("etiquette.cuvee")} name="cuvee" value={fields.cuvee ?? ""} badge={badge("cuvee")}
            onChange={(v) => setFields((f) => ({ ...f, cuvee: v || null }))} />
          <Champ label={t("etiquette.appellation")} name="appellation" value={fields.appellation ?? ""} badge={badge("appellation")}
            onChange={(v) => setFields((f) => ({ ...f, appellation: v || null }))} />
          <div className="flex gap-2.5">
            <Champ label={t("etiquette.millesime")} name="millesime" type="number" value={fields.millesime?.toString() ?? ""}
              badge={badge("millesime")} alerte={aConfirmer(confiance.millesime)}
              onChange={(v) => setFields((f) => ({ ...f, millesime: v ? Number(v) : null }))} />
            <Champ label={t("etiquette.degre")} name="degre" type="number" step="0.1" value={fields.degre?.toString() ?? ""}
              badge={badge("degre")} onChange={(v) => setFields((f) => ({ ...f, degre: v ? Number(v) : null }))} />
          </div>
          <label className="flex flex-col gap-1 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">{t("etiquette.couleur")} {badge("couleur")}</span>
            <select name="couleur" value={fields.couleur ?? ""} data-testid="champ-couleur"
              onChange={(e) => setFields((f) => ({ ...f, couleur: (e.target.value || null) as LabelFields["couleur"] }))}
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent">
              <option value="">—</option>
              {VIN_COULEURS.map((c) => <option key={c} value={c}>{t(`couleurs.${c}`)}</option>)}
            </select>
          </label>
          <Champ label={t("etiquette.cepages")} name="cepages" value={fields.cepages.join(", ")} badge={badge("cepages")}
            onChange={(v) => setFields((f) => ({ ...f, cepages: v.split(",").map((x) => x.trim()).filter(Boolean) }))} />
          <input type="hidden" name="region" value={fields.region ?? ""} />

          {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          <Button type="submit" pending={pending} disabled={nom.trim() === ""} data-testid="etiquette-enregistrer">
            {t("etiquette.continuer")}
          </Button>
        </form>
      )}
    </div>
  );
}

function Champ({ label, name, value, onChange, badge, type = "text", step, alerte = false }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  badge?: React.ReactNode; type?: string; step?: string; alerte?: boolean;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1 text-[11px] text-muted">
      <span className="flex items-center gap-1.5">{label} {badge}</span>
      <input name={name} type={type} step={step} value={value} data-testid={`champ-${name}`}
        onChange={(e) => onChange(e.target.value)} aria-label={label}
        className={`rounded-control border bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent ${
          alerte ? "border-kpi-amber" : "border-line"
        }`} />
    </label>
  );
}
