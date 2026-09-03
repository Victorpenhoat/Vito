"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/features/shared/ui/Button";
import { ReauthSheet } from "./ReauthSheet";

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

// Partage natif du scan (Web Share API niveau 2 — fichiers) ; fallback : ouvrir
// le document dans un onglet (iOS PWA sans partage fichier, desktop).
export function ShareScanButton({ docId, label, mimeType }: { docId: string; label: string; mimeType: string }) {
  const t = useTranslations("famille");
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  // Le partage sort le document de l'app : il exige la même vérification
  // que l'affichage (lot O-D).
  const url = (ticket: string) => `/api/famille/documents/${docId}?ticket=${encodeURIComponent(ticket)}`;

  async function share(ticket: string) {
    setBusy(true);
    try {
      const lien = url(ticket);
      const resp = await fetch(lien);
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const file = new File([blob], `${label}.${EXT[mimeType] ?? "bin"}`, { type: mimeType });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: label });
        return;
      }
      throw new Error("share-indisponible");
    } catch (e) {
      // AbortError = partage annulé par l'utilisateur : ne rien ouvrir
      if (!(e instanceof DOMException && e.name === "AbortError")) window.open(url(ticket), "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOuvert(true)} pending={busy}
        className="flex flex-1 items-center justify-center gap-2 shadow-none">
        <Upload size={15} aria-hidden />
        {t("doc.partager")}
      </Button>
      <ReauthSheet open={ouvert} onClose={() => setOuvert(false)} docId={docId}
        onTicket={(ticket) => void share(ticket)} />
    </>
  );
}
