"use client";
import { X } from "lucide-react";
import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export type OptionFiltre = { valeur: string; libelle: string; couleur?: string | null };

/**
 * Filtres cumulables de la vue « Tous ».
 *
 * Ils vivent dans l'URL, comme les sous-onglets : un carnet filtré se partage,
 * se recharge et se retrouve dans l'historique. Un état local aurait tout perdu
 * au premier retour arrière.
 */
export function FiltresActivites({ dimensions }: {
  dimensions: { cle: string; libelle: string; options: OptionFiltre[] }[];
}) {
  const t = useTranslations("activites.filtres");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const actifs = (cle: string) => params.getAll(cle);
  const actifsTotal = dimensions.reduce((n, d) => n + actifs(d.cle).length, 0);

  function basculer(cle: string, valeur: string) {
    const suivants = new URLSearchParams(params);
    const deja = params.getAll(cle);
    suivants.delete(cle);
    for (const v of deja.includes(valeur) ? deja.filter((x) => x !== valeur) : [...deja, valeur]) {
      suivants.append(cle, v);
    }
    router.replace(`${pathname}?${suivants.toString()}`, { scroll: false });
  }

  function effacer() {
    const suivants = new URLSearchParams(params);
    for (const d of dimensions) suivants.delete(d.cle);
    router.replace(suivants.size ? `${pathname}?${suivants.toString()}` : pathname, { scroll: false });
  }

  return (
    <div data-testid="activites-filtres" className="flex flex-col gap-2">
      {dimensions.map((d) => (
        <div key={d.cle} className="flex flex-wrap items-center gap-1.5">
          <span className="w-[62px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            {d.libelle}
          </span>
          {d.options.map((o) => {
            const choisi = actifs(d.cle).includes(o.valeur);
            return (
              <button key={o.valeur} type="button" aria-pressed={choisi}
                data-testid={`filtre-${d.cle}-${o.valeur}`}
                onClick={() => basculer(d.cle, o.valeur)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                  choisi ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:border-accent/30 hover:text-ink"
                }`}>
                {o.couleur && (
                  <span className="h-2 w-2 rounded-full" style={{ background: o.couleur }} aria-hidden />
                )}
                {o.libelle}
                {choisi && <X size={11} aria-hidden />}
              </button>
            );
          })}
        </div>
      ))}
      {actifsTotal > 0 && (
        <button type="button" data-testid="filtres-effacer" onClick={effacer}
          className="self-start text-[11.5px] font-semibold text-accent hover:underline">
          {t("effacer")}
        </button>
      )}
    </div>
  );
}
