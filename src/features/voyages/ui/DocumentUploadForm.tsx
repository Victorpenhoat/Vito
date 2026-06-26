"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ajouterDocument } from "../data/documents";
import { Button } from "@/features/shared/ui/Button";

export function DocumentUploadForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages.documents");
  const [state, action, pending] = useActionState(ajouterDocument, undefined);
  return (
    <form action={action} data-testid="document-upload-form" className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="voyageId" value={voyageId} />
      <input name="file" type="file" required accept=".pdf,image/jpeg,image/png,image/webp" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("deposer")}</Button>
    </form>
  );
}
