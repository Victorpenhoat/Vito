"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { retirerMembre, quitterFamille } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";
import { Badge } from "@/features/shared/ui/Badge";

type Membre = { profile_id: string; role: string; display_name: string | null };

export function MembresList({ membres, isOwner, currentProfileId }: { membres: Membre[]; isOwner: boolean; currentProfileId: string }) {
  const t = useTranslations("famille");
  const [, retirer] = useActionState(retirerMembre, undefined);
  const [, quitter] = useActionState(quitterFamille, undefined);
  return (
    <ul className="flex flex-col gap-2">
      {membres.map((m) => (
        <li key={m.profile_id} data-testid="membre-row" className="rounded-card border border-line bg-surface p-4 flex items-center gap-2">
          <span className="flex-1">{m.display_name ?? m.profile_id}</span>
          {m.role === "owner" && <Badge>{t("roleOwner")}</Badge>}
          {isOwner && m.role !== "owner" && (
            <form action={retirer}>
              <input type="hidden" name="profileId" value={m.profile_id} />
              <Button type="submit" variant="ghost" className="text-sm py-1 px-2">{t("retirer")}</Button>
            </form>
          )}
          {/* quitter : uniquement sur sa propre ligne (quitter_famille agit sur auth.uid) */}
          {!isOwner && m.role !== "owner" && m.profile_id === currentProfileId && (
            <form action={quitter}>
              <Button type="submit" variant="ghost" className="text-sm py-1 px-2">{t("quitter")}</Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
