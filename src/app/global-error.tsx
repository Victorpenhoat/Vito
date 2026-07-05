"use client";
import { useEffect } from "react";
import { log, errorContext } from "@/lib/log";

// Filet global (audit 04/07 : absent) : capture les erreurs du root layout lui-même,
// que les error.tsx par route ne couvrent pas. Remplace tout le document → doit rendre
// <html>/<body>. Volontairement sans i18n/kit (le layout a pu échouer avant leur montage).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    log.error("global_error", errorContext(error));
  }, [error]);
  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <p role="alert">Une erreur est survenue.</p>
        <button onClick={reset} style={{ textDecoration: "underline", cursor: "pointer" }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
