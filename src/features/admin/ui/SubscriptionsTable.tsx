import { getTranslations } from "next-intl/server";
import { Card } from "@/features/shared/ui/Card";

type Sub = { user_id: string; status: string; period: string; current_period_end: string };

export async function SubscriptionsTable({ subscriptions }: { subscriptions: Sub[] }) {
  const t = await getTranslations("admin");
  return (
    <Card data-testid="subscriptions-table" className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("subscriptions")}</h2>
      <table className="text-sm w-full">
        <thead>
          <tr>
            <th className="text-left pr-4 text-muted text-xs uppercase tracking-wide">{t("colClient")}</th>
            <th className="text-left pr-4 text-muted text-xs uppercase tracking-wide">{t("colStatut")}</th>
            <th className="text-left pr-4 text-muted text-xs uppercase tracking-wide">{t("colPeriode")}</th>
            <th className="text-left text-muted text-xs uppercase tracking-wide">{t("colDate")}</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((s) => (
            <tr key={s.user_id} className="border-b border-line">
              <td className="pr-4 py-2">{s.user_id}</td>
              <td className="pr-4 py-2 text-muted">{s.status}</td>
              <td className="pr-4 py-2 text-muted">{s.period}</td>
              <td className="py-2 text-muted">{new Date(s.current_period_end).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
