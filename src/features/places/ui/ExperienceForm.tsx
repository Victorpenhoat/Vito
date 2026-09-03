"use client";
import { useActionState, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { marquerVisite, marquerSejour } from "@/features/restos/data/actions";
import { creerTag } from "@/features/restos/data/tagActions";
import { CATEGORY_UI, type CategorieUi } from "../domain/categoryUiConfig";
import { voyagesCouvrant, type VoyageLite } from "../domain/voyageCouvrant";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { fieldClass } from "@/features/shared/ui/Input";

type TagLite = { id: string; slug: string; label: string; color: string | null };

// « J'y suis allé » / « J'y ai séjourné » (design Resto v2 écran 8, Hôtels v2
// écran 9) : date (ou plage arrivée→départ), note /10 au dixième (slider), tags
// de verdict (création à la volée), commentaire, « Passer en favori ? ».
// Le mode séjour ajoute le départ, l'occupation et le voyage lié détecté.
export function ExperienceForm({ listeItemId, tags, onDone, categorie = "resto", voyages = [] }: {
  listeItemId: string; tags: TagLite[]; onDone?: () => void; categorie?: CategorieUi; voyages?: VoyageLite[];
}) {
  const config = CATEGORY_UI[categorie];
  const sejour = config.experience === "sejour";
  const t = useTranslations(config.ns);
  const format = useFormatter();
  // Les deux actions ont la même signature applicative ; le cast évite un state
  // `unknown` sur l'union (piège useActionState déjà rencontré côté voyages).
  const [state, action, pending] = useActionState(
    sejour ? (marquerSejour as typeof marquerVisite) : marquerVisite,
    undefined,
  );
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [note, setNote] = useState(8);
  const [avecNote, setAvecNote] = useState(true);
  const [favori, setFavori] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [dispo, setDispo] = useState(tags);
  const [nouveau, setNouveau] = useState<string | null>(null);
  const [labelNouveau, setLabelNouveau] = useState("");
  const [tagPending, setTagPending] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  // mode séjour
  const [arrivee, setArrivee] = useState(aujourdhui);
  const [depart, setDepart] = useState("");
  const [delie, setDelie] = useState(false);

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone?.();
  }, [state, onDone]);

  // Voyage couvrant la plage saisie : proposé automatiquement, déliable.
  const candidats = sejour ? voyagesCouvrant(voyages, arrivee, depart || null) : [];
  const voyageLie = delie ? null : (candidats[0] ?? null);
  const nuits = arrivee && depart && depart > arrivee
    ? Math.round((Date.parse(depart) - Date.parse(arrivee)) / 86_400_000)
    : null;

  // Tag créé à la volée depuis le handler du formulaire (pas d'effet) :
  // il rejoint la liste, sélectionné d'office.
  async function creerTagVolee(fd: FormData) {
    const label = labelNouveau.trim();
    if (!label) return;
    setTagPending(true);
    setTagError(null);
    const res = await creerTag(undefined, fd);
    setTagPending(false);
    if (res && "error" in res && res.error) { setTagError(res.error); return; }
    if (res && "ok" in res && res.ok && "tagId" in res) {
      const id = res.tagId as string;
      setDispo((prev) => (prev.some((x) => x.id === id) ? prev : [...prev, { id, slug: id, label, color: null }]));
      setSelection((prev) => new Set(prev).add(id));
      setNouveau(null);
      setLabelNouveau("");
    }
  }

  function toggleTag(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={action} data-testid={sejour ? "sejour-form" : "visite-form"} className="flex flex-col gap-4">
        <input type="hidden" name="listeItemId" value={listeItemId} />
        {[...selection].map((id) => <input key={id} type="hidden" name="tagIds" value={id} />)}
        <input type="hidden" name="passerEnFavori" value={String(favori)} />
        {sejour && <input type="hidden" name="voyageId" value={voyageLie?.id ?? ""} />}

        {sejour ? (
          <>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <DateField name="visiteLe" label={t("visite.date")} value={arrivee} onChange={(e) => setArrivee(e.target.value)} />
              </div>
              <div className="flex-1">
                <DateField name="dateFin" label={t("visite.dateFin")} value={depart} min={arrivee} onChange={(e) => setDepart(e.target.value)} />
              </div>
            </div>
            {nuits != null && (
              <span data-testid="sejour-nuits" className="-mt-2 text-[11px] text-faint">{t("visite.nuits", { n: nuits })}</span>
            )}
            {voyageLie && (
              <div data-testid="voyage-lie" className="flex items-center gap-2.5 rounded-[5px] border border-accent/25 bg-accent-50 px-3.5 py-2.5">
                <span className="min-w-0 flex-1 text-[12px] text-ink">
                  {t("visite.voyageDetecte")} <b>{voyageLie.titre}</b>
                </span>
                <button type="button" data-testid="voyage-delier" onClick={() => setDelie(true)}
                  className="shrink-0 text-[11px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
                  {t("visite.delier")}
                </button>
              </div>
            )}
            {delie && candidats.length > 0 && (
              <button type="button" data-testid="voyage-relier" onClick={() => setDelie(false)}
                className="self-start text-[11px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
                {t("visite.relier")}
              </button>
            )}
          </>
        ) : (
          <DateField name="visiteLe" label={t("visite.date")} defaultValue={aujourdhui} />
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">{t("visite.note")}</span>
            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={avecNote} onChange={(e) => setAvecNote(e.target.checked)} />
              {t("visite.avecNote")}
            </label>
          </div>
          {avecNote && (
            <div className="flex items-center gap-3">
              <input type="range" name="note" min={0} max={10} step={0.1} value={note}
                onChange={(e) => setNote(Number(e.target.value))}
                aria-label={t("visite.note")} className="flex-1 accent-[var(--accent)]" />
              <span className="w-12 text-right font-serif text-xl text-ink">
                {format.number(note, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{t("visite.verdict")}</span>
          <div className="flex flex-wrap gap-1.5">
            {dispo.map((tg) => (
              <button key={tg.id} type="button" aria-pressed={selection.has(tg.id)} onClick={() => toggleTag(tg.id)}
                className={`rounded-full px-3 py-1.5 text-[11.5px] transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  selection.has(tg.id) ? "bg-ink font-semibold text-app" : "border border-line bg-surface-hover text-muted"
                }`}>
                {tg.label}
              </button>
            ))}
            <button type="button" data-testid="tag-volee" onClick={() => setNouveau("")}
              className="rounded-full border border-dashed border-accent/40 bg-accent-50 px-3 py-1.5 text-[11.5px] text-accent focus-visible:outline-2 focus-visible:outline-accent">
              {t("tags.ajouterVolee")}
            </button>
          </div>
        </div>

        <textarea name="commentaire" placeholder={t("visite.commentaire")} rows={2} className={fieldClass} />

        {sejour && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted">{t("visite.occupation")}</span>
            <div className="flex gap-2.5">
              {([["adultes", 2], ["enfants", 0], ["chambres", 1]] as const).map(([champ, def]) => (
                <label key={champ} className="flex flex-1 flex-col gap-1 text-[11px] text-muted">
                  {t(`visite.${champ}`)}
                  <input type="number" name={champ} min={champ === "enfants" ? 0 : 1} max={20} defaultValue={def}
                    data-testid={`occupation-${champ}`} aria-label={t(`visite.${champ}`)}
                    className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink">{t("visite.passerFavoriQ")}</span>
          <button type="button" role="switch" aria-checked={favori} onClick={() => setFavori((v) => !v)}
            aria-label={t("visite.passerFavoriQ")}
            className={`relative h-7 w-[46px] shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-accent ${favori ? "bg-accent" : "bg-line"}`}>
            <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-[left] ${favori ? "left-[21px]" : "left-[3px]"}`} />
          </button>
        </label>

        {state && "error" in state && state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" pending={pending}>{t("visite.enregistrer")}</Button>
      </form>

      {/* création de tag à la volée — formulaire séparé (pas de form imbriqué) */}
      {nouveau !== null && (
        <form action={creerTagVolee} className="flex items-center gap-2 border-t border-line pt-3">
          <input type="hidden" name="scope" value={config.tagScope} />
          <input name="label" value={labelNouveau} onChange={(e) => setLabelNouveau(e.target.value)}
            placeholder={t("tags.label")} aria-label={t("tags.label")} required
            className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
          <Button type="submit" pending={tagPending} className="py-2 text-xs">{t("tags.creer")}</Button>
        </form>
      )}
      {tagError && <p role="alert" className="text-sm text-danger">{tagError}</p>}
    </div>
  );
}
