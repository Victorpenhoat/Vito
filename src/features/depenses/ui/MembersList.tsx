"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { unshareGroupe } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

type Membre = { profile_id: string; role: string; display_name: string | null };

export function MembersList({ groupeId, membres, isOwner }: { groupeId: string; membres: Membre[]; isOwner: boolean }) {
  const t = useTranslations("depenses");
  const [, action] = useActionState(unshareGroupe, undefined);
  return (
    <ul className="flex flex-col gap-1">
      {membres.map((m) => (
        <li key={m.profile_id} data-testid="member-row" className="flex items-center gap-2">
          <span className="text-ink">{m.display_name ?? m.profile_id} {m.role === "owner" ? <span className="text-muted">({t("roleOwner")})</span> : ""}</span>
          {isOwner && m.role !== "owner" && (
            <form action={action}>
              <input type="hidden" name="groupeId" value={groupeId} />
              <input type="hidden" name="profileId" value={m.profile_id} />
              <Button type="submit" variant="ghost" className="text-sm px-2 py-1">{t("retirer")}</Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
