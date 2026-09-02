"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { statutTint } from "../domain/statutTint";

// Couverture d'un voyage : photo Places (proxy /api/places/photo) ou URL libre,
// avec repli sur le dégradé de statut (pattern PhotoVignette : une ref peut ne
// pas résoudre, et l'événement error peut précéder l'hydratation).
export function VoyageCover({
  photoRef,
  url,
  statut,
  className = "",
  children,
}: {
  photoRef: string | null;
  url: string | null;
  statut: string;
  className?: string;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const src = url ?? (photoRef ? `/api/places/photo?ref=${encodeURIComponent(photoRef)}&w=800` : null);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: statutTint(statut) }}>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element -- proxy privé/URL externe, incompatible next/image
        <img ref={ref} src={src} alt="" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {children}
    </div>
  );
}
