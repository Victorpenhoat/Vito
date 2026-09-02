"use client";
import dynamic from "next/dynamic";

// Leaflet ne supporte pas le SSR — même mécanique que PlacesMapLazy.
export const RestosMapLazy = dynamic(() => import("./RestosMap").then((m) => m.RestosMap), { ssr: false });
