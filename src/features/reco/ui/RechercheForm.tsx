"use client";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const TYPES = ["étoilé", "bistrot", "brasserie", "café", "restaurant"] as const;
const inputCls = "rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent";

export function RechercheForm() {
  const t = useTranslations("recherche");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };
  const currentType = params.get("type") ?? "";
  const typeTabs = [{ key: "", label: t("tous") }, ...TYPES.map((ty) => ({ key: ty, label: ty }))];
  return (
    <div data-testid="recherche-form" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <input aria-label={t("zone")} placeholder={t("zone")} defaultValue={params.get("zone") ?? ""} onBlur={(e) => set("zone", e.target.value)} className={inputCls} />
        <input aria-label={t("budget")} type="number" min={0} placeholder={t("budget")} defaultValue={params.get("budgetMax") ?? ""} onBlur={(e) => set("budgetMax", e.target.value)} className={`${inputCls} w-44`} />
      </div>
      <div className="flex flex-wrap gap-2">
        {typeTabs.map((it) => {
          const active = currentType === it.key;
          return (
            <button
              key={it.key || "tous"}
              type="button"
              onClick={() => set("type", it.key)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent-50 text-ink" : "border-line text-muted hover:bg-surface-hover"}`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
