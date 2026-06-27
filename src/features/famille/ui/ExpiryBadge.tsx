import { useTranslations } from "next-intl";

export function ExpiryBadge({ status, monthsLeft }: { status: "expired" | "soon" | "valid"; monthsLeft?: number }) {
  const t = useTranslations("famille");
  const cls =
    status === "valid" ? "bg-kpi-green-bg text-kpi-green"
    : status === "soon" ? "bg-kpi-amber-bg text-kpi-amber"
    : "bg-danger-bg text-danger";
  const label =
    status === "valid" ? t("expiry.valide")
    : status === "soon" ? t("expiry.expireDans", { n: monthsLeft ?? 0 })
    : t("expiry.expire");
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
