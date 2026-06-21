import { getTranslations } from "next-intl/server";
import { getGroupeDetail } from "../data/queries";
import { DepenseForm } from "./DepenseForm";
import { DepensesList } from "./DepensesList";
import { SoldesPanel } from "./SoldesPanel";
import { RemboursementForm } from "./RemboursementForm";
import { MembersList } from "./MembersList";
import { ShareForm } from "./ShareForm";

export async function GroupeDetail({ id }: { id: string }) {
  const t = await getTranslations("depenses");
  const { groupe, membres, depenses, soldes, transferts, isOwner } = await getGroupeDetail(id);
  const nameById = Object.fromEntries(membres.map((m) => [m.profile_id, m.display_name ?? m.profile_id]));
  const membresSimple = membres.map((m) => ({ profile_id: m.profile_id, display_name: m.display_name }));
  return (
    <article className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold">{groupe.titre}</h1>
        <p className="text-gray-600">{groupe.devise}</p>
      </header>

      <section>
        <h2 className="font-semibold">{t("depenses")}</h2>
        <DepensesList groupeId={groupe.id} depenses={depenses} devise={groupe.devise} nameById={nameById} />
        <DepenseForm groupeId={groupe.id} membres={membresSimple} />
      </section>

      <SoldesPanel soldes={soldes} transferts={transferts} devise={groupe.devise} nameById={nameById} />

      <section>
        <h2 className="font-semibold">{t("remboursement")}</h2>
        <RemboursementForm groupeId={groupe.id} membres={membresSimple} />
      </section>

      <section>
        <h2 className="font-semibold">{t("membres")}</h2>
        <MembersList groupeId={groupe.id} membres={membres} isOwner={isOwner} />
        {isOwner && <ShareForm groupeId={groupe.id} />}
      </section>
    </article>
  );
}
