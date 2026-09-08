"use client";
import dynamic from "next/dynamic";

// Leaflet ne supporte pas le rendu serveur, et ne doit pas peser sur le premier
// affichage des autres vues : il n'est téléchargé qu'en ouvrant la carte.
export const CarteActivitesLazy = dynamic(
  () => import("./CarteActivites").then((m) => m.CarteActivites),
  { ssr: false },
);
