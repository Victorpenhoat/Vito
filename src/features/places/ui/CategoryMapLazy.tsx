"use client";
import dynamic from "next/dynamic";

// Leaflet ne supporte pas le SSR — même mécanique que l'historique PlacesMapLazy.
export const CategoryMapLazy = dynamic(() => import("./CategoryMap").then((m) => m.CategoryMap), { ssr: false });
