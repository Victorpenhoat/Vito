"use client";
import dynamic from "next/dynamic";

export const PlacesMapLazy = dynamic(() => import("./PlacesMap").then((m) => m.PlacesMap), { ssr: false });
