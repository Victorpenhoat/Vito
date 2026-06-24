import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/rbac/guards";
import { getMesClients } from "@/features/agence/data/queries";
import { LierClientForm } from "@/features/agence/ui/LierClientForm";
import { ClientsList } from "@/features/agence/ui/ClientsList";
import { PageHeader } from "@/features/shared/ui/PageHeader";

export default async function AgencePage() {
  await requireRole(["agence", "admin"]); // redirige les non-autorisés vers /login
  const t = await getTranslations("agence");
  const clients = await getMesClients();
  return (
    <main className="p-4 md:p-6 flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("portefeuille")}</h2>
        <LierClientForm />
        <ClientsList clients={clients} />
      </section>
    </main>
  );
}
