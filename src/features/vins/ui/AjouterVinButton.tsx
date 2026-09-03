"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera } from "lucide-react";
import { Modal } from "@/features/shared/ui/Modal";
import { EtiquetteTunnel } from "./EtiquetteTunnel";
import { MaDegustationForm } from "./MaDegustationForm";

type TagLite = { id: string; slug: string; label: string; color: string | null };

// Point d'entrée de la capture (design Vins & Cave écrans 2 et 3) : le tunnel
// est en DEUX étapes, l'étiquette puis ma dégustation. La modale ne se ferme pas
// entre les deux — c'est un seul geste, « Étape 1/2 » puis « Étape 2/2 ».
export function AjouterVinButton({ vinsConnus, tags = [], etablissementId, etablissementNom, visiteId }: {
  vinsConnus: { id: string; cle: string; nb: number; dernier: string | null }[];
  tags?: TagLite[];
  etablissementId?: string;
  etablissementNom?: string;
  visiteId?: string;
}) {
  const t = useTranslations("vins");
  const [open, setOpen] = useState(false);
  const [cree, setCree] = useState<{ vinId: string; resume: string } | null>(null);
  // Identité stable : le tunnel annonce la création depuis un effet, et une
  // fonction recréée à chaque rendu le ferait se redéclencher en boucle.
  const passerEtape2 = useCallback((vinId: string, resume: string) => setCree({ vinId, resume }), []);

  const fermer = () => { setOpen(false); setCree(null); };

  return (
    <>
      <button type="button" data-testid="ajouter-vin" onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-control border border-accent/25 bg-accent-50 px-3.5 py-2.5 text-xs font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
        <Camera size={13} aria-hidden />
        {t("etiquette.ajouter")}
      </button>
      <Modal open={open} onClose={fermer}
        title={cree ? t("etiquette.etape2") : t("etiquette.titre")}>
        {cree ? (
          <MaDegustationForm vinId={cree.vinId} resume={cree.resume} tags={tags}
            etablissementId={etablissementId} etablissementNom={etablissementNom}
            visiteId={visiteId} onEnregistre={fermer} />
        ) : (
          <EtiquetteTunnel vinsConnus={vinsConnus} onCree={passerEtape2} />
        )}
      </Modal>
    </>
  );
}
