"use client";
import { startTransition, useActionState, useOptimistic } from "react";
import { useTranslations } from "next-intl";
import { toggleReminder } from "../data/actions";

// Rappel d'expiration (design Onglet_Cercle, écran 3) : préférence persistée,
// la notification push elle-même est un lot ultérieur.
export function ReminderToggle({ docId, initial }: { docId: string; initial: boolean }) {
  const t = useTranslations("famille");
  const [state, dispatch, pending] = useActionState(toggleReminder, undefined);
  const [on, setOptimistic] = useOptimistic(initial);

  function toggle() {
    const next = !on;
    const fd = new FormData();
    fd.set("id", docId);
    fd.set("reminder", String(next));
    startTransition(() => {
      setOptimistic(next);
      dispatch(fd);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-[5px] border border-line bg-surface px-3.5 py-3">
      <div>
        <div className="text-[13px] font-medium text-ink">{t("doc.rappelTitre")}</div>
        <div className="mt-0.5 text-[11.5px] text-faint">{t("doc.rappelTexte")}</div>
        {state && "error" in state && state.error && <p role="alert" className="mt-1 text-xs text-danger">{state.error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t("doc.rappelTitre")}
        disabled={pending}
        onClick={toggle}
        className={`relative h-7 w-[46px] shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-accent ${on ? "bg-accent" : "bg-line"}`}
      >
        <span
          className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(33,30,26,.25)] transition-[left] ${on ? "left-[21px]" : "left-[3px]"}`}
        />
      </button>
    </div>
  );
}
