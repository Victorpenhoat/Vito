"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { rejoindreAvecInvitation } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

// Rejoindre avec un lien quand on A DÉJÀ un compte (Lot F). Sans cet écran,
// un invité déjà inscrit n'avait d'autre issue que de créer un second compte.
export function RejoindreVoyage({ token, voyageTitre }: { token: string; voyageTitre: string | null }) {
  const t = useTranslations("invitations");
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function rejoindre() {
    setEnCours(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("token", token);
    const res = await rejoindreAvecInvitation(undefined, fd);
    setEnCours(false);
    if (!("ok" in res) || !res.ok) {
      setErreur(("error" in res && res.error) || t("rejoindre.echec"));
      return;
    }
    router.push(res.voyageId ? `/voyages/${res.voyageId}` : "/voyages");
  }

  return (
    <div data-testid="rejoindre-voyage" className="flex flex-col gap-2">
      {erreur && <p role="alert" className="text-[12.5px] text-danger">{erreur}</p>}
      <Button type="button" data-testid="rejoindre-valider" pending={enCours} onClick={rejoindre}>
        {voyageTitre ? t("rejoindre.ctaVoyage", { titre: voyageTitre }) : t("rejoindre.cta")}
      </Button>
      <p className="text-[11px] text-faint">{t("rejoindre.aide")}</p>
    </div>
  );
}
