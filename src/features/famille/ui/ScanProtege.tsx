"use client";
import { useState } from "react";
import { Lock, Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ReauthSheet } from "./ReauthSheet";

// Scan d'un document d'identité : verrouillé tant que l'identité n'a pas été
// vérifiée (design Onboarding écran 11). Auparavant l'image se chargeait dès
// l'ouverture de la page — la route la refuse désormais sans ticket.
export function ScanProtege({ docId, face, mime, caption, apercu, voirLabel }: {
  docId: string; face?: "verso"; mime: string; caption: string; apercu: string; voirLabel: string;
}) {
  const t = useTranslations("protege");
  const [ouvert, setOuvert] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const isImage = mime.startsWith("image/");
  const src = ticket
    ? `/api/famille/documents/${docId}?${face ? "face=verso&" : ""}ticket=${encodeURIComponent(ticket)}`
    : null;

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-[6px] border border-line bg-badge">
        {src ? (
          <>
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- route privée no-store, incompatible next/image
              <img src={src} alt={apercu} className="h-[180px] w-full object-cover" />
            ) : (
              <iframe src={src} title={apercu} className="h-[180px] w-full" />
            )}
            <a href={src} target="_blank" rel="noopener" aria-label={voirLabel}
              className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-surface/90 text-muted shadow focus-visible:outline-2 focus-visible:outline-accent">
              <Maximize2 size={13} aria-hidden />
            </a>
          </>
        ) : (
          <button type="button" data-testid={`afficher-scan${face ? "-verso" : ""}`}
            onClick={() => setOuvert(true)}
            className="flex h-[180px] w-full flex-col items-center justify-center gap-2 text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
            <Lock size={20} aria-hidden />
            <span className="text-[12.5px] font-semibold">{t("afficherDocument")}</span>
            <span className="px-6 text-center text-[11px] text-faint">{t("chaqueRevelation")}</span>
          </button>
        )}
      </div>
      <figcaption className="mt-1.5 text-center text-[11px] text-faint">{caption}</figcaption>
      <ReauthSheet open={ouvert} onClose={() => setOuvert(false)} docId={docId}
        face={face === "verso" ? "verso" : "recto"} onTicket={setTicket} />
    </figure>
  );
}
