import { getTranslations } from "next-intl/server";

type Demande = { id: string; type: string; statut: string; created_at: string };

export async function DemandesTable({ demandes }: { demandes: Demande[] }) {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("demandes")}</h2>
      <table data-testid="demandes-table" className="text-sm">
        <thead>
          <tr><th className="text-left pr-4">{t("colType")}</th><th className="text-left pr-4">{t("colStatut")}</th><th className="text-left">{t("colDate")}</th></tr>
        </thead>
        <tbody>
          {demandes.map((d) => (
            <tr key={d.id}>
              <td className="pr-4">{d.type}</td>
              <td className="pr-4">{d.statut}</td>
              <td>{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
