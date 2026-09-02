"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/features/shared/ui/Modal";
import { OrigineForm, type ProcheSuggestion } from "./OrigineForm";

// Bloc « Pourquoi c'est là » (design écran 6) : origine affichée + Modifier → écran 9.
export function OrigineBlock({
  listeItemId,
  origine,
  proches,
}: {
  listeItemId: string;
  origine: { type: "reco" | "trouve" | null; qui: string | null; source: string | null };
  proches: ProcheSuggestion[];
}) {
  const t = useTranslations("restos");
  const [open, setOpen] = useState(false);
  const texte =
    origine.type === "reco" ? t("origines.recoPar", { qui: origine.qui ?? "?" })
    : origine.type === "trouve" ? t("origines.trouvePar", { source: origine.source ?? "—" })
    : t("origines.aucune");
  return (
    <div data-testid="origine-block" className="rounded-[5px] border border-current/20 bg-kpi-amber-bg px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-kpi-amber">{t("origines.titre")}</span>
        <button type="button" onClick={() => setOpen(true)}
          className="text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
          {t("origines.modifier")}
        </button>
      </div>
      <p className="mt-1.5 text-[13px] text-ink">{texte}</p>
      <Modal open={open} onClose={() => setOpen(false)} title={t("origines.sheetTitre")}>
        <OrigineForm listeItemId={listeItemId} proches={proches} onDone={() => setOpen(false)}
          initial={{ type: origine.type, qui: origine.qui, source: origine.source }} />
      </Modal>
    </div>
  );
}
