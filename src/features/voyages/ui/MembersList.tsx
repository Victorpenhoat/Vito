"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { unshareVoyage } from "../data/actions";

type Membre = { profile_id: string; role: string; display_name: string | null };

export function MembersList({ voyageId, membres, isOwner }: { voyageId: string; membres: Membre[]; isOwner: boolean }) {
  const t = useTranslations("voyages");
  const [, action] = useActionState(unshareVoyage, undefined);
  return (
    <ul className="flex flex-col gap-1">
      {membres.map((m) => (
        <li key={m.profile_id} data-testid="member-row" className="flex items-center gap-2">
          <span className="text-ink">{m.display_name ?? m.profile_id} {m.role === "owner" ? <span className="text-muted text-sm">(owner)</span> : ""}</span>
          {isOwner && m.role !== "owner" && (
            <form action={action}>
              <input type="hidden" name="voyageId" value={voyageId} />
              <input type="hidden" name="profileId" value={m.profile_id} />
              <button type="submit" className="text-accent hover:underline text-sm">{t("retirer")}</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
