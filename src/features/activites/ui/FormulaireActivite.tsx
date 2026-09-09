"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { ajouterActivite } from "../data/actions";
import { TYPES_ACTIVITE } from "../domain/activite";
import { Button } from "@/features/shared/ui/Button";

/** « + Nouvelle activité » : le strict nécessaire, le reste s'ajoute sur la fiche. */
export function FormulaireActivite({ membres, libelle }: {
  membres: { id: string; prenom: string }[];
  /** L'état vide dit « Ajouter une activité » là où l'en-tête dit « Nouvelle ». */
  libelle?: string;
}) {
  const t = useTranslations("activites");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const res = await ajouterActivite(prev, fd);
      // On file sur la fiche : c'est là qu'on ajoute horaires, coût et codes.
      if ("ok" in res && res.ok) { setOuvert(false); router.push(`/activites/${res.id}`); }
      return res;
    },
    undefined,
  );

  if (!ouvert) {
    return (
      <button type="button" data-testid="activite-ajouter" onClick={() => setOuvert(true)}
        className="inline-flex self-start rounded-full border border-dashed border-accent/40 bg-accent-50 px-3.5 py-1.5 text-[12px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
        + {libelle ?? t("nouvelle.ouvrir")}
      </button>
    );
  }

  const champ = "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent";
  return (
    <form action={action} data-testid="activite-form" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("nouvelle.titre")}</h2>
      <input name="nom" data-testid="activite-nom" placeholder={t("nouvelle.nom")} aria-label={t("nouvelle.nom")} className={champ} />
      <div className="flex flex-wrap gap-2">
        <select name="type" data-testid="activite-type" aria-label={t("filtres.type")} defaultValue="autre" className={`${champ} min-w-0 flex-1`}>
          {TYPES_ACTIVITE.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
        </select>
        <input name="formuleSeances" data-testid="activite-formule" inputMode="numeric"
          placeholder={t("nouvelle.formule")} aria-label={t("nouvelle.formule")} className={`${champ} w-40`} />
      </div>
      <input name="clubNom" data-testid="activite-club" placeholder={t("nouvelle.club")} aria-label={t("nouvelle.club")} className={champ} />
      <input name="adresse" data-testid="activite-adresse" placeholder={t("nouvelle.adresse")} aria-label={t("nouvelle.adresse")} className={champ} />
      <input name="telephone" data-testid="activite-telephone" placeholder={t("nouvelle.telephone")} aria-label={t("nouvelle.telephone")} className={champ} />
      <div className="flex flex-wrap gap-2">
        <input name="contactNom" data-testid="activite-contact-nom" placeholder={t("nouvelle.contactNom")}
          aria-label={t("nouvelle.contactNom")} className={`${champ} min-w-0 flex-1`} />
        <input name="contactTelephone" data-testid="activite-contact-tel" placeholder={t("nouvelle.contactTel")}
          aria-label={t("nouvelle.contactTel")} className={`${champ} min-w-0 flex-1`} />
      </div>

      {membres.length > 0 && (
        <>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("nouvelle.membres")}</span>
          <ul className="flex flex-wrap gap-2">
            {membres.map((m) => (
              <li key={m.id}>
                <label className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink">
                  <input type="checkbox" name="membres" value={m.id} data-testid={`activite-membre-${m.id}`} aria-label={m.prenom} />
                  {m.prenom}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      {state && "error" in state && state.error && (
        <p role="alert" className="text-[12px] text-danger">{state.error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" pending={pending} data-testid="activite-valider">{t("nouvelle.enregistrer")}</Button>
        <button type="button" onClick={() => setOuvert(false)} className="text-[12.5px] text-muted hover:text-ink">
          {t("annuler")}
        </button>
      </div>
    </form>
  );
}
