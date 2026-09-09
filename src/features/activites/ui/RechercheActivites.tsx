"use client";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * « Activité, club, intervenant… ».
 *
 * La frappe est reportée dans l'URL après une pause : sans elle, chaque lettre
 * déclencherait un rendu serveur, et le champ perdrait le curseur en cours de
 * saisie.
 */
export function RechercheActivites() {
  const t = useTranslations("activites");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const dansLUrl = params.get("q") ?? "";
  const [saisie, setSaisie] = useState(dansLUrl);

  useEffect(() => {
    // Ne naviguer que si la saisie DIFFÈRE de l'URL. Sans cette garde, le
    // composant réécrivait l'URL à chaque montage — donc après chaque clic sur
    // un filtre — et effaçait le filtre qu'on venait de poser.
    if (saisie.trim() === dansLUrl) return;
    const pause = setTimeout(() => {
      const suivants = new URLSearchParams(params);
      if (saisie.trim()) suivants.set("q", saisie.trim());
      else suivants.delete("q");
      const cible = suivants.size ? `${pathname}?${suivants.toString()}` : pathname;
      router.replace(cible, { scroll: false });
    }, 250);
    return () => clearTimeout(pause);
    // `dansLUrl` est dans les dépendances À DESSEIN : si une navigation était
    // en vol au moment du report, celle-ci a pu se perdre. En réagissant au
    // retour de l'URL, l'effet se rattrape — et il ne boucle pas, puisque la
    // garde ci-dessus le fait sortir une fois les deux alignés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie, dansLUrl]);

  return (
    <label className="flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2">
      <Search size={14} className="shrink-0 text-faint" aria-hidden />
      <input
        data-testid="activites-recherche"
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        placeholder={t("recherchePlaceholder")}
        aria-label={t("recherchePlaceholder")}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
      />
    </label>
  );
}
