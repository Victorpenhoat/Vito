"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { retirerMembre, quitterFamille } from "../data/actions";

type Membre = { profile_id: string; role: string; display_name: string | null };

export function MembresList({ membres, isOwner, currentProfileId }: { membres: Membre[]; isOwner: boolean; currentProfileId: string }) {
  const t = useTranslations("famille");
  const [, retirer] = useActionState(retirerMembre, undefined);
  const [, quitter] = useActionState(quitterFamille, undefined);
  return (
    <ul className="flex flex-col gap-1">
      {membres.map((m) => (
        <li key={m.profile_id} data-testid="membre-row" className="flex items-center gap-2">
          <span>{m.display_name ?? m.profile_id} {m.role === "owner" ? `(${t("roleOwner")})` : ""}</span>
          {isOwner && m.role !== "owner" && (
            <form action={retirer}>
              <input type="hidden" name="profileId" value={m.profile_id} />
              <button type="submit" className="underline text-sm">{t("retirer")}</button>
            </form>
          )}
          {/* quitter : uniquement sur sa propre ligne (quitter_famille agit sur auth.uid) */}
          {!isOwner && m.role !== "owner" && m.profile_id === currentProfileId && (
            <form action={quitter}>
              <button type="submit" className="underline text-sm">{t("quitter")}</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
