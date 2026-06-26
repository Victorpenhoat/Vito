import { getTranslations } from "next-intl/server";
import { getGroupeDetail } from "../data/queries";
import { formatCents } from "../domain/money";
import { DepenseForm } from "./DepenseForm";
import { DepensesList } from "./DepensesList";
import { SoldesPanel } from "./SoldesPanel";
import { RemboursementForm } from "./RemboursementForm";
import { MembersList } from "./MembersList";
import { ShareForm } from "./ShareForm";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export async function GroupeDetail({ id }: { id: string }) {
  const t = await getTranslations("depenses");
  const { groupe, membres, depenses, soldes, transferts, isOwner } = await getGroupeDetail(id);
  const nameById = Object.fromEntries(membres.map((m) => [m.profile_id, m.display_name ?? m.profile_id]));
  const membresSimple = membres.map((m) => ({ profile_id: m.profile_id, display_name: m.display_name }));
  const total = depenses.reduce((s, d) => s + d.montant_cents, 0);
  const parPersonne = Math.round(total / Math.max(membres.length, 1));
  return (
    <article className="flex flex-col gap-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{t("eyebrow")}</p>
        <h1 className="font-serif text-3xl font-medium text-ink">{groupe.titre}</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <section>
          <SectionLabel>{t("depenses")}</SectionLabel>
          <DepensesList groupeId={groupe.id} depenses={depenses} devise={groupe.devise} nameById={nameById} />
          <DepenseForm groupeId={groupe.id} membres={membresSimple} />
        </section>

        <aside className="flex flex-col gap-6">
          <Card>
            <SectionLabel>{t("total")}</SectionLabel>
            <div className="font-serif text-3xl font-medium text-ink">{formatCents(total, groupe.devise)}</div>
            <div className="mt-1 text-sm text-muted">{t("parPersonne", { montant: formatCents(parPersonne, groupe.devise) })}</div>
          </Card>
          <Card>
            <SoldesPanel soldes={soldes} transferts={transferts} devise={groupe.devise} nameById={nameById} />
          </Card>
          <Card>
            <SectionLabel>{t("remboursement")}</SectionLabel>
            <RemboursementForm groupeId={groupe.id} membres={membresSimple} />
          </Card>
          <Card>
            <SectionLabel>{t("membres")}</SectionLabel>
            <MembersList groupeId={groupe.id} membres={membres} isOwner={isOwner} />
            {isOwner && <ShareForm groupeId={groupe.id} />}
          </Card>
        </aside>
      </div>
    </article>
  );
}
