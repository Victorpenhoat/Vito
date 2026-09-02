"use client";
import { useActionState, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { marquerVisite } from "@/features/restos/data/actions";
import { creerTag } from "@/features/restos/data/tagActions";
import { CATEGORY_UI, type CategorieUi } from "../domain/categoryUiConfig";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { fieldClass } from "@/features/shared/ui/Input";

type TagLite = { id: string; slug: string; label: string; color: string | null };

// « J'y suis allé » (design Onglet_Resto_v2, écran 8) : date, note /10 au dixième
// (slider), tags de verdict (ajoutés à l'item, création à la volée), commentaire,
// « Passer en favori ? ». Brique générique : le namespace i18n et la portée des
// tags viennent de la catégorie (le mode « séjour » hôtel arrive au lot H3).
export function ExperienceForm({ listeItemId, tags, onDone, categorie = "resto" }: {
  listeItemId: string; tags: TagLite[]; onDone?: () => void; categorie?: CategorieUi;
}) {
  const config = CATEGORY_UI[categorie];
  const t = useTranslations(config.ns);
  const format = useFormatter();
  const [state, action, pending] = useActionState(marquerVisite, undefined);
  const [note, setNote] = useState(8);
  const [avecNote, setAvecNote] = useState(true);
  const [favori, setFavori] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [dispo, setDispo] = useState(tags);
  const [nouveau, setNouveau] = useState<string | null>(null);
  const [labelNouveau, setLabelNouveau] = useState("");
  const [tagPending, setTagPending] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone?.();
  }, [state, onDone]);

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
      <form action={action} data-testid="visite-form" className="flex flex-col gap-4">
        <input type="hidden" name="listeItemId" value={listeItemId} />
        {[...selection].map((id) => <input key={id} type="hidden" name="tagIds" value={id} />)}
        <input type="hidden" name="passerEnFavori" value={String(favori)} />

        <DateField name="visiteLe" label={t("visite.date")} defaultValue={new Date().toISOString().slice(0, 10)} />

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
