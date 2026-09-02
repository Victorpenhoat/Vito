"use client";
import { useState } from "react";
import { Check, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

// Partage natif du lien de la fiche (Web Share API) ; fallback : copie du lien.
export function ShareVoyageButton({ titre }: { titre: string }) {
  const t = useTranslations("voyages");
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: titre, url }); return; }
      throw new Error("share-indisponible");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch { /* presse-papier indisponible */ }
    }
  }
  return (
    <button type="button" onClick={() => void share()} aria-label={t("partager")}
      className="grid h-[38px] w-[38px] place-items-center rounded-full bg-surface/95 text-ink shadow focus-visible:outline-2 focus-visible:outline-accent">
      {copied ? <Check size={15} className="text-kpi-green" aria-hidden /> : <Upload size={15} aria-hidden />}
    </button>
  );
}
