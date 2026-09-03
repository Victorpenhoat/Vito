"use client";
import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Avatar } from "@/features/shared/ui/Avatar";
import { ThemeToggle } from "@/features/shared/ui/ThemeToggle";
import { signOut } from "@/features/auth/data/actions";
import { retirerCarnet } from "@/features/voyages/data/horsLigneClient";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function ShellFooter({ userName, role }: { userName: string; role: string }) {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3 text-sm">
      {/* Réglages : l'entrée pointait sur /gouts faute de page dédiée (Onboarding lot O-A) */}
      <Link href="/reglages" data-testid="lien-reglages" className="flex items-center gap-2 text-muted hover:text-ink">
        <Settings size={18} /> {ts("settings")}
      </Link>
      <div className="flex items-center gap-2">
        <Avatar name={userName} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-ink">{userName}</div>
          <div className="text-xs capitalize text-faint">{role}</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      {/* Se déconnecter retire aussi le carnet emporté : sur un appareil partagé,
          un voyage resterait autrement consultable après le départ de son
          propriétaire, mode voyage oblige — sans aucune vérification. */}
      <form action={async () => { await retirerCarnet(); await signOut(); }}>
        <button type="submit" className="text-left text-muted hover:text-ink">{t("deconnexion")}</button>
      </form>
    </div>
  );
}
