import { getTranslations } from "next-intl/server";
import { Card } from "@/features/shared/ui/Card";

type User = { id: string; role: string; display_name: string | null; created_at: string };

export async function UsersTable({ users }: { users: User[] }) {
  const t = await getTranslations("admin");
  return (
    <Card data-testid="users-table" className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("users")}</h2>
      <table className="text-sm w-full">
        <thead>
          <tr>
            <th className="text-left pr-4 text-muted text-xs uppercase tracking-wide">{t("colNom")}</th>
            <th className="text-left pr-4 text-muted text-xs uppercase tracking-wide">{t("colRole")}</th>
            <th className="text-left text-muted text-xs uppercase tracking-wide">{t("colDate")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-line">
              <td className="pr-4 py-2">{u.display_name ?? u.id}</td>
              <td className="pr-4 py-2 text-muted">{u.role}</td>
              <td className="py-2 text-muted">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
