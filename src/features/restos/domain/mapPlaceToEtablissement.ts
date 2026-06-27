import type { PlaceResult } from "@/lib/services/places/types";
import { classifyFallback } from "./classifyFallback";

export type EtablissementInput = {
  place_id: string;
  categorie: "resto" | "hotel";
  type: string;
  nom: string;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  arrondissement: string | null;
  lat: number | null;
  lng: number | null;
  telephone: string | null;
  website: string | null;
  price_level: number | null;
  rating: number | null;
  rating_count: number | null;
  source: string;
  photo_ref: string | null;
};

function arrondissementParisien(codePostal: string | null, ville: string | null): string | null {
  if (!codePostal || !ville || !ville.toLowerCase().includes("paris")) return null;
  if (!/^75\d{3}$/.test(codePostal)) return null;
  const n = Number(codePostal.slice(3));
  if (n < 1 || n > 20) return null;
  return n === 1 ? "1er" : `${n}e`; // convention FR : 1er, puis 2e, 3e…
}

export function mapPlaceToEtablissement(p: PlaceResult, categorie: "resto" | "hotel" = "resto"): EtablissementInput {
  return {
    place_id: p.placeId,
    categorie,
    type: categorie === "hotel" ? "hotel" : classifyFallback(p.types, p.priceLevel),
    nom: p.nom,
    adresse: p.adresse,
    ville: p.ville,
    code_postal: p.codePostal,
    arrondissement: arrondissementParisien(p.codePostal, p.ville),
    lat: p.lat,
    lng: p.lng,
    telephone: p.telephone,
    website: p.website,
    price_level: p.priceLevel,
    rating: p.rating,
    rating_count: p.ratingCount,
    source: "places",
    photo_ref: p.photoRefs[0] ?? null,
  };
}
