"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/features/shared/ui/Modal";
import { ExperienceForm } from "@/features/places/ui/ExperienceForm";

type TagLite = { id: string; slug: string; label: string; color: string | null };

// CTA « J'y suis allé » de la fiche (design écran 6) → formulaire de visite en modale.
export function VisiteCta({ listeItemId, nom, tags }: { listeItemId: string; nom: string; tags: TagLite[] }) {
  const t = useTranslations("restos");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="visite-cta" onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-control bg-accent py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent">
        ✓ {t("visite.cta")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("visite.titre", { nom })}>
        <ExperienceForm listeItemId={listeItemId} tags={tags} categorie="resto" onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
