"use client";
import { useEffect, useRef } from "react";
import { cacheEtablissementPhoto } from "../data/actions";

// Rendu uniquement quand le cache doit être (re)rempli ; déclenche l'écriture une seule fois.
export function PhotoCacheSync({ etabId, photoRef }: { etabId: string; photoRef: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !photoRef) return;
    done.current = true;
    void cacheEtablissementPhoto(etabId, photoRef);
  }, [etabId, photoRef]);
  return null;
}
