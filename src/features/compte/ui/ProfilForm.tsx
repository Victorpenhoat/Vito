"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfil } from "../data/actions";
import { Avatar } from "@/features/shared/ui/Avatar";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";

// Réglages > Profil (design Onboarding écran 5). La photo reste hors périmètre :
// le PO a tranché « initiales seulement » pour le Cercle, on garde la même règle
// ici (aucun stockage d'image, l'avatar dérive du nom).
export function ProfilForm({ firstName, lastName, email }: {
  firstName: string | null; lastName: string | null; email: string | null;
}) {
  const t = useTranslations("compte");
  const [state, action, pending] = useActionState(updateProfil, undefined);
  const nom = [firstName, lastName].filter(Boolean).join(" ") || (email ?? "");

  return (
    <form action={action} data-testid="profil-form" className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <Avatar name={nom} size="lg" />
        <div className="min-w-0">
          <div className="truncate text-sm text-ink">{nom}</div>
          {email && <div className="truncate text-[12px] text-faint">{email}</div>}
        </div>
      </div>
      <p className="text-[12px] text-muted">{t("profil.fiche")}</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-[11px] text-muted">
          {t("profil.prenom")}
          <Input name="firstName" required defaultValue={firstName ?? ""} data-testid="profil-prenom"
            aria-label={t("profil.prenom")} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[11px] text-muted">
          {t("profil.nom")}
          <Input name="lastName" defaultValue={lastName ?? ""} data-testid="profil-nom"
            aria-label={t("profil.nom")} />
        </label>
      </div>
      {state && "error" in state && state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state && "ok" in state && state.ok && (
        <p data-testid="profil-enregistre" className="text-sm text-kpi-green">{t("profil.enregistre")}</p>
      )}
      <Button type="submit" pending={pending} className="self-start">{t("profil.enregistrer")}</Button>
    </form>
  );
}
