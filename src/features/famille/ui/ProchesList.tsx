import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";
import type { Proche } from "../data/queries";
import { Avatar } from "@/features/shared/ui/Avatar";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { RelationChip } from "./RelationChip";
import { ExpiryBadge } from "./ExpiryBadge";
import { CIRCLES } from "../domain/schemas";

export async function ProchesList({ proches }: { proches: Proche[] }) {
  const t = await getTranslations("famille");
  return (
    <div className="flex flex-col gap-6">
      {CIRCLES.map((circle) => {
        const group = proches.filter((p) => p.circle === circle);
        if (group.length === 0) return null;
        return (
          <section key={circle} className="flex flex-col gap-3">
            <SectionLabel>{t(`circles.${circle}`)}</SectionLabel>
            <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 xl:grid-cols-3">
              {group.map((p) => (
                <li key={p.id} data-testid="proche-row">
                  <Link href={`/famille/proches/${p.id}`} className="block">
                    <Card className="flex items-center gap-3">
                      <Avatar name={`${p.first_name} ${p.last_name}`} size="lg" color={p.avatar_color ?? undefined} />
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-lg text-ink">{p.first_name} {p.last_name}</div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <RelationChip relation={p.relation} />
                          <span className="text-sm text-muted">{t("proches.documentsCount", { n: p.doc_count })}</span>
                        </div>
                      </div>
                      {(p.urgency === "expired" || p.urgency === "soon") && <ExpiryBadge status={p.urgency} monthsLeft={p.urgency_months ?? undefined} />}
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
