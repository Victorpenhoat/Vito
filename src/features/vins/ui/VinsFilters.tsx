"use client";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/features/shared/ui/Input";

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
      <Input aria-label={t("region")} placeholder={t("region")} defaultValue={params.get("region") ?? ""} onBlur={(e) => set("region", e.target.value)} />
      <Input aria-label={t("filtres.noteMin")} type="number" min={1} max={5} placeholder={t("filtres.noteMin")} defaultValue={params.get("noteMin") ?? ""} onBlur={(e) => set("noteMin", e.target.value)} className="w-28" />
      <Input aria-label={t("filtres.du")} type="date" defaultValue={params.get("dateFrom") ?? ""} onChange={(e) => set("dateFrom", e.target.value)} />
      <Input aria-label={t("filtres.au")} type="date" defaultValue={params.get("dateTo") ?? ""} onChange={(e) => set("dateTo", e.target.value)} />
      <button type="button" onClick={() => router.replace(pathname)} className="text-accent hover:underline">{t("filtres.reset")}</button>
    </div>
  );
}
