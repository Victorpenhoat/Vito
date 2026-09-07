"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { ajouterCreneau } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

const JOURS = [1, 2, 3, 4, 5, 6, 7];

/** « Ajouter un créneau » : jour, heures, lieu, intervenant, et qui dépose. */
export function FormulaireCreneau({ activiteId, membres }: {
  activiteId: string; membres: { id: string; prenom: string }[];
}) {
  const t = useTranslations("activites");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const res = await ajouterCreneau(prev, fd);
      if ("ok" in res && res.ok) { setOuvert(false); router.refresh(); }
      return res;
    },
    undefined,
  );

  if (!ouvert) {
    return (
      <button type="button" data-testid="creneau-ajouter" onClick={() => setOuvert(true)}
        className="self-start text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
        + {t("horaires.ajouter")}
      </button>
    );
  }

  const champ = "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent";
  return (
    <form action={action} data-testid="creneau-form" className="flex flex-col gap-2 rounded-control border border-line bg-surface-hover p-3">
      <input type="hidden" name="activiteId" value={activiteId} />
      <div className="flex flex-wrap gap-2">
        <select name="jourSemaine" data-testid="creneau-jour" aria-label={t("horaires.jour")} defaultValue="6" className={champ}>
          {JOURS.map((j) => <option key={j} value={j}>{t(`jours.${j}`)}</option>)}
        </select>
        <input type="time" name="heureDebut" data-testid="creneau-debut" aria-label={t("horaires.debut")} defaultValue="10:00" className={champ} />
        <input type="time" name="heureFin" data-testid="creneau-fin" aria-label={t("horaires.fin")} defaultValue="11:00" className={champ} />
      </div>
      <input name="lieuPrecision" data-testid="creneau-lieu" placeholder={t("horaires.lieuPrecision")} aria-label={t("horaires.lieuPrecision")} className={champ} />
      <input name="intervenant" data-testid="creneau-intervenant" placeholder={t("horaires.intervenantPlaceholder")} aria-label={t("horaires.intervenantPlaceholder")} className={champ} />
      <select name="deposePar" data-testid="creneau-depose" aria-label={t("horaires.deposeLabel")} defaultValue="" className={champ}>
        {/* Vide = « à définir » : c'est une réponse, pas une absence de saisie. */}
        <option value="">{t("horaires.deposeADefinir")}</option>
        {membres.map((m) => <option key={m.id} value={m.id}>{m.prenom}</option>)}
      </select>
      {state && "error" in state && state.error && (
        <p role="alert" className="text-[12px] text-danger">{state.error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" pending={pending} data-testid="creneau-valider">{t("horaires.enregistrer")}</Button>
        <button type="button" onClick={() => setOuvert(false)} className="text-[12.5px] text-muted hover:text-ink">
          {t("annuler")}
        </button>
      </div>
    </form>
  );
}
