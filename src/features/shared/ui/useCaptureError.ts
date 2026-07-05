"use client";
import { useEffect } from "react";
import { log, errorContext } from "@/lib/log";

// Capture les erreurs qui atteignent une error boundary (jusqu'ici seulement affichées,
// jamais loggées → invisibles en prod). Le digest Next relie le log à l'erreur serveur.
export function useCaptureError(error: unknown, boundary: string): void {
  useEffect(() => {
    log.error("render_boundary", { boundary, ...errorContext(error) });
  }, [error, boundary]);
}
