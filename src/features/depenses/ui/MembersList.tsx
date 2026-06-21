"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { unshareGroupe } from "../data/actions";

type Membre = { profile_id: string; role: string; display_name: string | null };

export function MembersList({ groupeId, membres, isOwner }: { groupeId: string; membres: Membre[]; isOwner: boolean }) {
  const t = useTranslations("depenses");
  const [, action] = useActionState(unshareGroupe, undefined);
  return (
    <ul className="flex flex-col gap-1">
      {membres.map((m) => (
        <li key={m.profile_id} data-testid="member-row" className="flex items-center gap-2">
          <span>{m.display_name ?? m.profile_id} {m.role === "owner" ? "(owner)" : ""}</span>
          {isOwner && m.role !== "owner" && (
            <form action={action}>
              <input type="hidden" name="groupeId" value={groupeId} />
              <input type="hidden" name="profileId" value={m.profile_id} />
              <button type="submit" className="underline text-sm">{t("retirer")}</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
