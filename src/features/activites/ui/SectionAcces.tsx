"use client";
import { useActionState, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { ValeurProtegee } from "@/features/shared/ui/ValeurProtegee";
import { Button } from "@/features/shared/ui/Button";
import { ajouterCode, revelerCode } from "../data/actionsProtegees";
import { MASQUE } from "@/lib/securite/masque";

/**
 * Les codes d'accès : portail, vestiaire, casier.
 *
 * La page ne contient jamais la valeur, même chiffrée — elle n'arrive qu'après
 * vérification du mot de passe, et chaque révélation est journalisée.
 */
export function SectionAcces({ activiteId, codes }: {
  activiteId: string;
  codes: { id: string; libelle: string; note: string | null }[];
}) {
  const t = useTranslations("activites");
  const tp = useTranslations("protege");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const res = await ajouterCode(prev, fd);
      if ("ok" in res && res.ok) { setOuvert(false); router.refresh(); }
      return res;
    },
    undefined,
  );

  const champ = "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent";
  return (
    <section data-testid="section-acces" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("sections.acces")}</h2>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-kpi-green">
          <ShieldCheck size={11} aria-hidden />
          {tp("chaqueRevelation")}
        </span>
      </header>

      {codes.length === 0 ? (
        <p className="text-[12.5px] text-muted">{t("acces.aucun")}</p>
      ) : (
        <ul className="flex flex-col">
          {codes.map((c) => (
            <li key={c.id} data-testid="code-row" className="flex flex-col gap-0.5 border-b border-line-soft py-2 last:border-b-0">
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{c.libelle}</span>
                <ValeurProtegee id={c.id} masque={MASQUE} reveler={revelerCode} libelle={c.libelle} />
              </span>
              {c.note && <span className="text-[11.5px] text-faint">{c.note}</span>}
            </li>
          ))}
        </ul>
      )}

      {!ouvert ? (
        <button type="button" data-testid="code-ajouter" onClick={() => setOuvert(true)}
          className="self-start text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
          + {t("acces.ajouter")}
        </button>
      ) : (
        <form action={action} data-testid="code-form" className="flex flex-col gap-2 rounded-control border border-line bg-surface-hover p-3">
          <input type="hidden" name="activiteId" value={activiteId} />
          <input name="libelle" data-testid="code-libelle" placeholder={t("acces.libelle")} aria-label={t("acces.libelle")} className={champ} />
          <input name="valeur" data-testid="code-valeur" placeholder={t("acces.valeur")} aria-label={t("acces.valeur")} className={champ} />
          <input name="note" data-testid="code-note" placeholder={t("acces.note")} aria-label={t("acces.note")} className={champ} />
          {state && "error" in state && state.error && (
            <p role="alert" className="text-[12px] text-danger">{state.error}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" pending={pending} data-testid="code-valider">{t("acces.enregistrer")}</Button>
            <button type="button" onClick={() => setOuvert(false)} className="text-[12.5px] text-muted hover:text-ink">
              {t("annuler")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
