import { getTranslations } from "next-intl/server";
import { getSessionRole } from "@/lib/rbac/guards";
import { getMesDemandes, getInboxConciergerie } from "@/features/conciergerie/data/queries";
import { DemandesList } from "@/features/conciergerie/ui/DemandesList";
import { DemandeHotelForm } from "@/features/conciergerie/ui/DemandeHotelForm";
import { ConciergeInbox } from "@/features/conciergerie/ui/ConciergeInbox";

export default async function ConciergeriePage() {
  const t = await getTranslations("conciergerie");
  const role = await getSessionRole();
  const isStaff = role === "agence" || role === "admin";
  if (isStaff) {
    const demandes = await getInboxConciergerie();
    return (
      <main className="p-6 flex flex-col gap-6">
        <h1 className="text-2xl font-bold">{t("inbox")}</h1>
        <ConciergeInbox demandes={demandes} />
      </main>
    );
  }
  const demandes = await getMesDemandes();
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <section>
        <h2 className="font-semibold">{t("mesDemandes")}</h2>
        <DemandesList demandes={demandes} />
      </section>
      <section>
        <h2 className="font-semibold">{t("types.hotel")}</h2>
        <DemandeHotelForm />
      </section>
    </main>
  );
}
