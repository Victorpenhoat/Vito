"use client";
import dynamic from "next/dynamic";

// Leaflet ne supporte pas le SSR — même mécanique que CategoryMapLazy.
export const CaveMapLazy = dynamic(() => import("./CaveMap").then((m) => m.CaveMap), { ssr: false });
