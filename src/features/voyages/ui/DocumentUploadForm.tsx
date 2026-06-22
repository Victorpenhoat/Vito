"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ajouterDocument } from "../data/documents";

export function DocumentUploadForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages.documents");
  const [state, action, pending] = useActionState(ajouterDocument, undefined);
  return (
    <form action={action} data-testid="document-upload-form" className="flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="voyageId" value={voyageId} />
      <input name="file" type="file" required accept=".pdf,image/jpeg,image/png,image/webp" className="border p-2" />
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("deposer")}</button>
    </form>
  );
}
