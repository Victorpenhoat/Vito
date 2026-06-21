"use client";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { VIN_COULEURS } from "../domain/schemas";

export function VinsFilters() {
  const t = useTranslations("vins");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };
  return (
    <div data-testid="vins-filters" className="flex flex-wrap gap-2 items-end">
      <select aria-label={t("couleur")} defaultValue={params.get("couleur") ?? ""} onChange={(e) => set("couleur", e.target.value)} className="border p-2">
        <option value="">{t("filtres.tous")}</option>
        {VIN_COULEURS.map((c) => <option key={c} value={c}>{t(`couleurs.${c}`)}</option>)}
      </select>
      <input aria-label={t("region")} placeholder={t("region")} defaultValue={params.get("region") ?? ""} onBlur={(e) => set("region", e.target.value)} className="border p-2" />
      <input aria-label={t("filtres.noteMin")} type="number" min={1} max={5} placeholder={t("filtres.noteMin")} defaultValue={params.get("noteMin") ?? ""} onBlur={(e) => set("noteMin", e.target.value)} className="border p-2 w-24" />
      <input aria-label={t("filtres.du")} type="date" defaultValue={params.get("dateFrom") ?? ""} onChange={(e) => set("dateFrom", e.target.value)} className="border p-2" />
      <input aria-label={t("filtres.au")} type="date" defaultValue={params.get("dateTo") ?? ""} onChange={(e) => set("dateTo", e.target.value)} className="border p-2" />
      <button type="button" onClick={() => router.replace(pathname)} className="underline">{t("filtres.reset")}</button>
    </div>
  );
}
