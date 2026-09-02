"use client";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { supprimerDocument } from "../data/actions";

export function DeleteDocumentButton({ id, label, confirmMsg }: { id: string; label: string; confirmMsg: string }) {
  const [state, dispatch, pending] = useActionState(supprimerDocument, undefined);
  return (
    <form action={dispatch} onSubmit={(e) => { if (!confirm(confirmMsg)) e.preventDefault(); }} className="flex flex-col">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={label}
        disabled={pending}
        className="grid h-full min-h-[44px] w-12 place-items-center rounded-control border border-line bg-surface text-danger transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
      >
        <Trash2 size={16} aria-hidden />
      </button>
      {state && "error" in state && state.error && <p role="alert" className="mt-1 text-xs text-danger">{state.error}</p>}
    </form>
  );
}
