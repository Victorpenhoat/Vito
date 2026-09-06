"use client";
import { useState } from "react";
import { Check, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { partager } from "@/lib/platform/partage";

// Partage du lien de la fiche.
//
// Trois chemins, un seul geste : la feuille de partage iOS dans la coque,
// l'API du navigateur quand il en a une, le presse-papiers sinon. C'est le
// helper qui choisit ; ici on se contente de dire « copié » quand ça l'est —
// et surtout pas quand l'utilisateur a refermé la feuille de partage.
export function ShareVoyageButton({ titre }: { titre: string }) {
  const t = useTranslations("voyages");
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if ((await partager({ titre, url: window.location.href })) !== "copie") return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* presse-papiers indisponible : le geste n'a rien à rattraper */ }
  }
  return (
    <button type="button" onClick={() => void share()} aria-label={t("partager")}
      className="grid h-[38px] w-[38px] place-items-center rounded-full bg-surface/95 text-ink shadow focus-visible:outline-2 focus-visible:outline-accent">
      {copied ? <Check size={15} className="text-kpi-green" aria-hidden /> : <Upload size={15} aria-hidden />}
    </button>
  );
}
