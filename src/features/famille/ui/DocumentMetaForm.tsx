"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { DocMeta } from "../data/queries";
import { modifierDocument } from "../data/actions";
import { DOC_TYPES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";

// Modification des métadonnées d'un document (écran 3 → Modifier). Le scan
// lui-même ne se remplace pas : on supprime et on re-crée via le tunnel.
export function DocumentMetaForm({ doc }: { doc: DocMeta }) {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(modifierDocument, undefined);
  const [docType, setDocType] = useState(doc.doc_type);
  return (
    <form action={action} data-testid="document-meta-form" className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="id" value={doc.id} />
      <Select label={t("tunnel.steps.type")} name="docType" value={docType} onChange={(e) => setDocType(e.target.value)}>
        {DOC_TYPES.map((dt) => <option key={dt} value={dt}>{t(`docTypes.${dt}`)}</option>)}
      </Select>
      {docType === "autre" && (
        <Input label={t("tunnel.autreTypeNom")} name="doc_label" defaultValue={doc.doc_label ?? ""} required />
      )}
      <Input label={t("doc.numero")} name="doc_number" defaultValue={doc.doc_number ?? ""} />
      <Input label={t("tunnel.dTitulaire")} name="holder_name" defaultValue={doc.holder_name ?? ""} />
      <div className="grid grid-cols-2 gap-2.5">
        <Input label={t("doc.emission")} name="issue_date" type="date" defaultValue={doc.issue_date ?? ""} />
        <Input label={t("doc.expiration")} name="expiry_date" type="date" defaultValue={doc.expiry_date ?? ""} />
      </div>
      <Input label={t("doc.autorite")} name="issue_place" defaultValue={doc.issue_place ?? ""} />
      <Input label={t("doc.pays")} name="country" defaultValue={doc.country ?? ""} />
      {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("form.enregistrer")}</Button>
    </form>
  );
}
