"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { arrondirVerres, noteApresClic, verresPour, VERRE_MAX } from "../domain/verres";

// Note en VERRES (design Vins & Cave écran 3). La note resto est /10 : les
// verres existent pour qu'on ne confonde jamais les deux d'un coup d'œil.

/** Affichage seul — utilisé dans les listes et sur la fiche. */
export function VerresLecture({ note, taille = 13 }: { note: number | null; taille?: number }) {
  const { pleins, demi, vides } = verresPour(note);
  return (
    <span className="inline-flex items-center gap-[1px]" style={{ fontSize: taille }} aria-hidden>
      {Array.from({ length: pleins }, (_, i) => <span key={`p${i}`}>🍷</span>)}
      {demi && <span className="opacity-45">🍷</span>}
      {Array.from({ length: vides }, (_, i) => <span key={`v${i}`} className="opacity-15">🍷</span>)}
    </span>
  );
}

/**
 * Saisie : un clic donne le verre plein, un second clic sur le même verre donne
 * le demi (au doigt, le design parle d'appui long — le second appui fait le
 * même travail sans dépendre d'un geste que rien n'indique à l'écran).
 */
export function NoteVerres({ name, defaultValue = null }: { name: string; defaultValue?: number | null }) {
  const t = useTranslations("vins");
  const [note, setNote] = useState<number | null>(defaultValue == null ? null : arrondirVerres(defaultValue));
  const { pleins, demi } = verresPour(note);

  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name={name} value={note ?? ""} />
      <div className="flex items-center gap-2" data-testid="note-verres" data-note={note ?? ""}>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: VERRE_MAX }, (_, i) => {
            const rang = i + 1;
            const plein = rang <= pleins;
            const moitie = demi && rang === pleins + 1;
            return (
              <button key={rang} type="button" data-testid={`verre-${rang}`}
                aria-label={t("verres.aria", { n: rang })}
                aria-pressed={plein || moitie}
                onClick={() => setNote(noteApresClic(rang, note))}
                className={`rounded p-0.5 text-lg leading-none transition focus-visible:outline-2 focus-visible:outline-accent ${
                  plein ? "opacity-100" : moitie ? "opacity-45" : "opacity-15 hover:opacity-40"
                }`}>
                🍷
              </button>
            );
          })}
        </div>
        {note != null && (
          <span className="text-[13px] font-semibold text-ink">
            {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: note % 1 ? 1 : 0 }).format(note)}
          </span>
        )}
      </div>
      <p className="text-[11px] text-faint">{t("verres.aide")}</p>
    </div>
  );
}
