import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Link } from "@/lib/i18n/routing";

// Sommaire des réglages (design Onboarding écran 13). Les sections arrivent au
// fil des lots : seules celles qui mènent quelque part sont cliquables, les
// autres sont annoncées « bientôt » plutôt que d'ouvrir un écran vide.
type Section = { cle: string; href?: string; bientot?: boolean; adminSeul?: boolean };

const SECTIONS: Section[] = [
  { cle: "profil", href: "/reglages" },
  { cle: "securite", href: "/reglages" },
  { cle: "appareils", bientot: true },
  { cle: "partages", bientot: true },
  { cle: "donnees", bientot: true },
  { cle: "tags", href: "/restos/tags" },
  { cle: "gouts", href: "/gouts" },
  { cle: "abonnement", href: "/abonnement" },
  { cle: "comptes", href: "/admin", adminSeul: true },
];

export async function ReglagesSections({ role }: { role: string }) {
  const t = await getTranslations("compte");
  const visibles = SECTIONS.filter((s) => !s.adminSeul || role === "admin");

  return (
    <nav data-testid="reglages-sections" className="divide-y divide-line-soft overflow-hidden rounded-[5px] border border-line bg-surface">
      {visibles.map((s) => {
        const contenu = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] text-ink">{t(`sections.${s.cle}`)}</span>
              <span className="block text-[11.5px] text-faint">{t(`sections.${s.cle}Sous`)}</span>
            </span>
            {s.bientot ? (
              <span className="shrink-0 rounded-full border border-line bg-surface-hover px-2 py-0.5 text-[10px] text-muted">
                {t("bientot")}
              </span>
            ) : (
              <ChevronRight size={15} className="shrink-0 text-faint" aria-hidden />
            )}
          </>
        );
        return s.href && !s.bientot ? (
          <Link key={s.cle} href={s.href} data-testid={`section-${s.cle}`}
            className="flex items-center gap-3 px-3.5 py-3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent">
            {contenu}
          </Link>
        ) : (
          <div key={s.cle} data-testid={`section-${s.cle}`} className="flex items-center gap-3 px-3.5 py-3 opacity-70">
            {contenu}
          </div>
        );
      })}
    </nav>
  );
}
