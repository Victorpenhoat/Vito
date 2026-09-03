"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/features/shared/ui/Modal";
import { ExperienceForm } from "@/features/places/ui/ExperienceForm";
import { CATEGORY_UI, type CategorieUi } from "@/features/places/domain/categoryUiConfig";
import type { VoyageLite } from "@/features/places/domain/voyageCouvrant";

type TagLite = { id: string; slug: string; label: string; color: string | null };

// CTA « J'y suis allé » / « J'y ai séjourné » de la fiche (design Resto v2
// écran 6, Hôtels v2 écran 6) → formulaire en modale.
export function VisiteCta({ listeItemId, nom, tags, categorie = "resto", voyages = [], encart }: {
  listeItemId: string; nom: string; tags: TagLite[]; categorie?: CategorieUi; voyages?: VoyageLite[];
  encart?: React.ReactNode;
}) {
  const t = useTranslations(CATEGORY_UI[categorie].ns);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="visite-cta" onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-control bg-accent py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent">
        ✓ {t("visite.cta")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("visite.titre", { nom })}>
        <ExperienceForm listeItemId={listeItemId} tags={tags} categorie={categorie} voyages={voyages}
          encart={encart} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
