import { getTranslations } from "next-intl/server";
import { Card } from "@/features/shared/ui/Card";

type Demande = { id: string; type: string; statut: string; created_at: string };

export async function DemandesTable({ demandes }: { demandes: Demande[] }) {
  const t = await getTranslations("admin");
  return (
    <Card data-testid="demandes-table" className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("demandes")}</h2>
      <table className="text-sm w-full">
        <thead>
          <tr>
            <th className="text-left pr-4 text-muted text-xs uppercase tracking-wide">{t("colType")}</th>
            <th className="text-left pr-4 text-muted text-xs uppercase tracking-wide">{t("colStatut")}</th>
            <th className="text-left text-muted text-xs uppercase tracking-wide">{t("colDate")}</th>
          </tr>
        </thead>
        <tbody>
          {demandes.map((d) => (
            <tr key={d.id} className="border-b border-line">
              <td className="pr-4 py-2">{d.type}</td>
              <td className="pr-4 py-2 text-muted">{d.statut}</td>
              <td className="py-2 text-muted">{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
