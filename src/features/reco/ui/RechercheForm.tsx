"use client";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const TYPES = ["étoilé", "bistrot", "brasserie", "café", "restaurant"] as const;

export function RechercheForm() {
  const t = useTranslations("recherche");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };
  return (
    <div data-testid="recherche-form" className="flex flex-wrap gap-2 items-end">
      <input aria-label={t("zone")} placeholder={t("zone")} defaultValue={params.get("zone") ?? ""} onBlur={(e) => set("zone", e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent" />
      <input aria-label={t("budget")} type="number" min={0} placeholder={t("budget")} defaultValue={params.get("budgetMax") ?? ""} onBlur={(e) => set("budgetMax", e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent w-40" />
      <select aria-label={t("type")} defaultValue={params.get("type") ?? ""} onChange={(e) => set("type", e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent">
        <option value="">{t("tous")}</option>
        {TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
      </select>
    </div>
  );
}
