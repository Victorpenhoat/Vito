import { X } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";

export type OptionFiltre = { valeur: string; libelle: string; couleur?: string | null };
export type DimensionFiltre = { cle: string; libelle: string; options: OptionFiltre[] };

/**
 * Filtres cumulables, rendus par le SERVEUR : ce sont des liens, pas des
 * boutons.
 *
 * Comme les sous-onglets, ils vivent dans l'URL — un carnet filtré se partage
 * et survit au retour arrière. Et puisqu'ils ne dépendent d'aucun script, ils
 * répondent avant même l'hydratation : un clic rapide n'est jamais perdu.
 */
export async function FiltresActivites({ params, dimensions }: {
  params: Record<string, string | string[] | undefined>;
  dimensions: DimensionFiltre[];
}) {
  const t = await getTranslations("activites.filtres");
  const locale = await getLocale();
  // Des ancres ORDINAIRES, pas le routeur client : deux clics rapprochés
  // déclenchaient deux navigations douces, dont la seconde annulait la
  // première — un filtre coché qui ne s'appliquait pas. Une navigation
  // complète coûte un aller-retour, mais elle arrive TOUJOURS.
  const url = (chemin: string) => `/${locale}${chemin}`;

  const actifs = (cle: string): string[] => {
    const v = params[cle];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  };

  /** L'URL qu'obtient un clic : la valeur bascule, le reste ne bouge pas. */
  const lien = (cle: string, valeur: string) => {
    const suivants = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === cle || v === undefined) continue;
      for (const x of Array.isArray(v) ? v : [v]) suivants.append(k, x);
    }
    const deja = actifs(cle);
    for (const x of deja.includes(valeur) ? deja.filter((y) => y !== valeur) : [...deja, valeur]) {
      suivants.append(cle, x);
    }
    const qs = suivants.toString();
    return qs ? `/activites?${qs}` : "/activites";
  };

  const sansFiltres = () => {
    const suivants = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (dimensions.some((d) => d.cle === k) || v === undefined) continue;
      for (const x of Array.isArray(v) ? v : [v]) suivants.append(k, x);
    }
    const qs = suivants.toString();
    return qs ? `/activites?${qs}` : "/activites";
  };

  // Ce qui filtre, dit en toutes lettres et retirable une par une : les cases
  // cochées le montrent déjà, mais éparpillées dans quatre dimensions. Cette
  // ligne rassemble la réponse à « pourquoi je ne vois que ça ? ».
  const posees = dimensions.flatMap((d) =>
    actifs(d.cle).flatMap((v) => {
      const o = d.options.find((x) => x.valeur === v);
      return o ? [{ cle: d.cle, ...o }] : [];
    }),
  );

  return (
    <div data-testid="activites-filtres" className="flex flex-col gap-2">
      {posees.length > 0 && (
        <div data-testid="filtres-poses" className="flex flex-wrap items-center gap-1.5">
          {posees.map((o) => (
            <a key={`${o.cle}-${o.valeur}`} href={url(lien(o.cle, o.valeur))}
              data-testid={`filtre-pose-${o.valeur}`} aria-label={t("retirer", { libelle: o.libelle })}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-ink px-3 py-1 text-[12px] font-medium text-white">
              {o.couleur && <span className="h-2 w-2 rounded-full" style={{ background: o.couleur }} aria-hidden />}
              {o.libelle}
              <X size={11} aria-hidden />
            </a>
          ))}
          <a href={url(sansFiltres())} data-testid="filtres-effacer"
            className="text-[11.5px] font-semibold text-accent hover:underline">
            {t("effacer")}
          </a>
        </div>
      )}

      {dimensions.map((d) => (
        <div key={d.cle} className="flex flex-wrap items-center gap-1.5">
          <span className="w-[62px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            {d.libelle}
          </span>
          {d.options.map((o) => {
            const choisi = actifs(d.cle).includes(o.valeur);
            return (
              <a key={o.valeur} href={url(lien(d.cle, o.valeur))} aria-current={choisi ? "true" : undefined}
                data-testid={`filtre-${d.cle}-${o.valeur}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                  choisi ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:border-accent/30 hover:text-ink"
                }`}>
                {o.couleur && (
                  <span className="h-2 w-2 rounded-full" style={{ background: o.couleur }} aria-hidden />
                )}
                {o.libelle}
                {choisi && <X size={11} aria-hidden />}
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}
