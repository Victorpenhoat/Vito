"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function BuyButton({ url }: { url: string | null }) {
  const t = useTranslations("vins");
  const [qty, setQty] = useState(1);
  if (!url) return null;
  // L'URL reçue est déjà construite pour qty=1 ; on ajuste le paramètre qty côté client.
  const href = url.replace(/qty=\d+/, `qty=${qty}`);
  return (
    <div className="flex items-center gap-2">
      <label>{t("quantite")}
        <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="border p-1 w-16 ml-1" />
      </label>
      <a data-testid="buy-button" href={href} target="_blank" rel="noopener noreferrer" className="bg-black text-white p-2">{t("acheter")}</a>
    </div>
  );
}
