"use client";
import type { AnchorHTMLAttributes } from "react";
import { estNatif } from "@/lib/platform/natif";
import { ouvrirLienExterne } from "@/lib/platform/liens";

// Un lien qui sort de Vito : Google Maps, le site d'un restaurant, un marchand.
//
// Le balisage reste celui d'un lien — clic droit, « ouvrir dans un nouvel
// onglet », lecteurs d'écran, tests e2e : rien ne change sur le web. Seule la
// coque détourne le clic vers le navigateur du système, qui se pose PAR-DESSUS
// l'app au lieu de la remplacer.
//
// Réservé aux liens EXTERNES. Un document privé de Vito (un scan, un voucher)
// doit rester dans la WebView : le navigateur du système ne partage pas la
// session, il afficherait une page d'erreur.
export function LienExterne({
  href, children, ...rest
}: { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!estNatif()) return;
        e.preventDefault();
        void ouvrirLienExterne(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
