"use client";
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[PWA] service worker registration failed", err);
        }
      });
    }
  }, []);
  return null;
}
