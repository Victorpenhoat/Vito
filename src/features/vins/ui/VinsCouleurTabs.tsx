"use client";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { VIN_COULEURS } from "../domain/schemas";

export function VinsCouleurTabs() {
  const t = useTranslations("vins");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("couleur") ?? "";
  const go = (couleur: string) => {
    const next = new URLSearchParams(params.toString());
    if (couleur) next.set("couleur", couleur);
    else next.delete("couleur");
    router.replace(`${pathname}?${next.toString()}`);
  };
  const tabs = [
    { key: "", testid: "vin-tab-tous", label: t("filtres.tous") },
    ...VIN_COULEURS.map((c) => ({ key: c, testid: `vin-tab-${c}`, label: t(`couleurs.${c}`) })),
  ];
  return (
    <div role="tablist" className="flex flex-wrap gap-6 border-b border-line">
      {tabs.map((it) => {
        const active = current === it.key;
        return (
          <button
            key={it.testid}
            type="button"
            role="tab"
            data-testid={it.testid}
            aria-selected={active}
            onClick={() => go(it.key)}
            className={`-mb-px border-b-2 pb-3 text-sm ${active ? "border-ink font-semibold text-ink" : "border-transparent text-muted"}`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
