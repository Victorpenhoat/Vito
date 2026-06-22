import { getTranslations } from "next-intl/server";

type User = { id: string; role: string; display_name: string | null; created_at: string };

export async function UsersTable({ users }: { users: User[] }) {
  const t = await getTranslations("admin");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("users")}</h2>
      <table data-testid="users-table" className="text-sm">
        <thead>
          <tr><th className="text-left pr-4">{t("colNom")}</th><th className="text-left pr-4">{t("colRole")}</th><th className="text-left">{t("colDate")}</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="pr-4">{u.display_name ?? u.id}</td>
              <td className="pr-4">{u.role}</td>
              <td>{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
