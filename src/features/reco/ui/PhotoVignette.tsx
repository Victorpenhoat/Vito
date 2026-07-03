"use client";
import { useEffect, useRef, useState } from "react";

// Une photo_ref peut ne pas résoudre (ref Google expirée, ref mock hors provider mock…) :
// sans fallback, le navigateur rend l'icône d'image cassée avec l'alt qui déborde de la
// vignette. En cas d'échec de chargement, on retombe sur le monogramme des items sans photo.
export function PhotoVignette({ src, nom }: { src: string | null; nom: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const initial = nom.charAt(0).toUpperCase();

  useEffect(() => {
    // L'img est rendue côté serveur : si elle échoue avant l'hydratation, l'événement
    // error est perdu (le handler React n'est pas encore attaché) — on rattrape l'état.
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-control bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={ref} src={src} alt={nom} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span data-testid="photo-monogramme" className="flex h-full w-full items-center justify-center font-serif text-lg text-faint">{initial}</span>
      )}
    </span>
  );
}
