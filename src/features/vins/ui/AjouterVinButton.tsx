"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Camera } from "lucide-react";
import { Modal } from "@/features/shared/ui/Modal";
import { EtiquetteTunnel } from "./EtiquetteTunnel";

// Point d'entrée de la capture (design Vins & Cave, écrans 2 et 11) : ouvre le
// tunnel en modale depuis la cave.
export function AjouterVinButton({ vinsConnus }: {
  vinsConnus: { id: string; cle: string; nb: number; dernier: string | null }[];
}) {
  const t = useTranslations("vins");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="ajouter-vin" onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-control border border-accent/25 bg-accent-50 px-3.5 py-2.5 text-xs font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
        <Camera size={13} aria-hidden />
        {t("etiquette.ajouter")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("etiquette.titre")}>
        <EtiquetteTunnel vinsConnus={vinsConnus} onCree={() => setOpen(false)} />
      </Modal>
    </>
  );
}
