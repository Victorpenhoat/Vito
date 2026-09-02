"use client";
import { useActionState, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { marquerVisite } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { fieldClass } from "@/features/shared/ui/Input";

type TagLite = { id: string; slug: string; label: string; color: string | null };

// « J'y suis allé » (design Onglet_Resto_v2, écran 8) : date, note /10 au dixième
// (slider), tags de verdict (ajoutés à l'item), commentaire, « Passer en favori ? ».
export function VisiteForm({ listeItemId, tags, onDone }: { listeItemId: string; tags: TagLite[]; onDone?: () => void }) {
  const t = useTranslations("restos");
  const format = useFormatter();
  const [state, action, pending] = useActionState(marquerVisite, undefined);
  const [note, setNote] = useState(8);
  const [avecNote, setAvecNote] = useState(true);
  const [favori, setFavori] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone?.();
  }, [state, onDone]);

  function toggleTag(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
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

      {tags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{t("visite.verdict")}</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tg) => (
              <button key={tg.id} type="button" aria-pressed={selection.has(tg.id)} onClick={() => toggleTag(tg.id)}
                className={`rounded-full px-3 py-1.5 text-[11.5px] transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  selection.has(tg.id) ? "bg-ink font-semibold text-app" : "border border-line bg-surface-hover text-muted"
                }`}>
                {tg.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
  );
}
