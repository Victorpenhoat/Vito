import { getTranslations } from "next-intl/server";

type Sub = { user_id: string; status: string; period: string; current_period_end: string };

export async function SubscriptionsTable({ subscriptions }: { subscriptions: Sub[] }) {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("subscriptions")}</h2>
      <table data-testid="subscriptions-table" className="text-sm">
        <thead>
          <tr><th className="text-left pr-4">{t("colClient")}</th><th className="text-left pr-4">{t("colStatut")}</th><th className="text-left pr-4">{t("colPeriode")}</th><th className="text-left">{t("colDate")}</th></tr>
        </thead>
        <tbody>
          {subscriptions.map((s) => (
            <tr key={s.user_id}>
              <td className="pr-4">{s.user_id}</td>
              <td className="pr-4">{s.status}</td>
              <td className="pr-4">{s.period}</td>
              <td>{new Date(s.current_period_end).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
