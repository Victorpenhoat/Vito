"use client";
import { useActionState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { useEffect } from "react";
import { deleteVoyage } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function DeleteVoyageButton({ id, label, confirmMsg }: { id: string; label: string; confirmMsg: string }) {
  const [state, action, pending] = useActionState(deleteVoyage, undefined);
  const router = useRouter();
  // deleteVoyage revalide /voyages sans rediriger (action historique) : on
  // navigue côté client une fois la suppression confirmée.
  useEffect(() => {
    if (state && "ok" in state && state.ok) router.push("/voyages");
  }, [state, router]);
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(confirmMsg)) e.preventDefault(); }} className="flex flex-col gap-1">
      <input type="hidden" name="voyageId" value={id} />
      <Button type="submit" variant="ghost" pending={pending} className="self-start text-danger">{label}</Button>
      {state && "error" in state && state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
