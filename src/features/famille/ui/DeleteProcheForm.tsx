"use client";
import { useActionState } from "react";
import { supprimerProche } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function DeleteProcheForm({ id, label, confirmMsg }: { id: string; label: string; confirmMsg: string }) {
  const [, supprimer] = useActionState(supprimerProche, undefined);
  return (
    <form action={supprimer} onSubmit={(e) => { if (!confirm(confirmMsg)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" className="text-danger">{label}</Button>
    </form>
  );
}
