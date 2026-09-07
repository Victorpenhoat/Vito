import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";

/** Les quatre vues de l'onglet, dans l'ordre du design. */
export const ONGLETS_ACTIVITES = ["en_cours", "semaine", "tous", "carte"] as const;
export type OngletActivites = (typeof ONGLETS_ACTIVITES)[number];

export function ongletValide(brut: string | undefined): OngletActivites {
  return (ONGLETS_ACTIVITES as readonly string[]).includes(brut ?? "")
    ? (brut as OngletActivites)
    : "en_cours";
}

// Sous-onglets rendus par le SERVEUR : ce sont des liens, pas un état local.
// Une vue partagée ou rechargée retombe donc où elle était, et le contenu de
// chaque onglet est rendu côté serveur plutôt que téléchargé puis filtré.
export async function SousOnglets({ actif }: { actif: OngletActivites }) {
  const t = await getTranslations("activites.onglets");
  return (
    <nav data-testid="activites-onglets" className="flex gap-1.5 overflow-x-auto pb-0.5">
      {ONGLETS_ACTIVITES.map((o) => (
        <Link
          key={o}
          href={o === "en_cours" ? "/activites" : `/activites?onglet=${o}`}
          data-testid={`onglet-${o}`}
          aria-current={o === actif ? "page" : undefined}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
            o === actif
              ? "border-ink bg-ink text-white"
              : "border-line bg-surface text-muted hover:border-accent/30 hover:text-ink"
          }`}
        >
          {t(o)}
        </Link>
      ))}
    </nav>
  );
}
