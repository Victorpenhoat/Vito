import { useTranslations } from "next-intl";

// Chip d'état de validité (design Onglet_Cercle) : valide (· année) / expire
// bientôt / expiré — variante `dot` + `docLabel` pour la liste (« CNI expire bientôt »).
export function ExpiryBadge({
  status,
  monthsLeft,
  year,
  docLabel,
  dot = false,
}: {
  status: "expired" | "soon" | "valid";
  monthsLeft?: number;
  year?: string;
  docLabel?: string;
  dot?: boolean;
}) {
  const t = useTranslations("famille");
  const cls =
    status === "valid" ? "bg-kpi-green-bg text-kpi-green"
    : status === "soon" ? "bg-kpi-amber-bg text-kpi-amber"
    : "bg-danger-bg text-danger";
  const label =
    status === "valid" ? (year ? t("expiry.valideAnnee", { annee: year }) : t("expiry.valide"))
    : status === "soon" ? (docLabel ? t("expiry.expireBientotDoc", { doc: docLabel }) : t("expiry.expireDans", { n: monthsLeft ?? 0 }))
    : docLabel ? t("expiry.expireDoc", { doc: docLabel }) : t("expiry.expire");
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-current/20 px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {dot && <span className="h-[5px] w-[5px] rounded-full bg-current" aria-hidden />}
      {label}
    </span>
  );
}
