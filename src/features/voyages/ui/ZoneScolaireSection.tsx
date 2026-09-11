"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { enregistrerZoneScolaire } from "../data/actionsZone";
import { ZONES } from "../domain/zoneScolaire";
import { Button } from "@/features/shared/ui/Button";

// Réglages > Vacances scolaires (tâche 5). Déduire n'est pas décider : tant que
// `zoneEnregistree` est nulle, la zone déduite de l'adresse n'est qu'une
// suggestion — rien ici n'écrit d'elle-même en base, seul l'envoi du
// formulaire par l'utilisateur le fait (cf. actionsZone.ts).
export function ZoneScolaireSection({ zoneEnregistree, zoneDeduite }: {
  zoneEnregistree: string | null;
  zoneDeduite: string | null;
}) {
  const t = useTranslations("voyages");
  const [state, action, pending] = useActionState(enregistrerZoneScolaire, undefined);
  const valeur = zoneEnregistree ?? zoneDeduite ?? "";

  return (
    <form action={action} data-testid="zone-scolaire-section" className="flex flex-col gap-3 rounded-[5px] border border-line bg-surface px-3.5 py-3">
      <div className="text-[13.5px] text-ink">{t("zone.titre")}</div>

      <select name="zone" defaultValue={valeur} data-testid="zone-scolaire-select"
        className="w-full max-w-xs rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent">
        {/* Sans zone enregistrée ni déduite, aucune option ne doit paraître
            choisie : un select sans correspondance retomberait sur la
            première (« Zone A ») et ferait croire à un choix jamais fait. */}
        {!valeur && <option value="" disabled>—</option>}
        {ZONES.map((zone) => (
          <option key={zone} value={zone}>{zone}</option>
        ))}
      </select>

      {/* Ce paragraphe n'existe QUE tant que rien n'est enregistré : sa
          présence à l'écran est donc la preuve que la déduction n'a pas
          écrit en base — c'est ce que la spec e2e éprouve. */}
      {!zoneEnregistree && zoneDeduite && (
        <p data-testid="zone-scolaire-deduite" className="text-[11.5px] text-muted">
          {t("zone.deduite", { zone: zoneDeduite })}
        </p>
      )}
      {!zoneEnregistree && !zoneDeduite && (
        <p className="text-[11.5px] text-muted">{t("zone.inconnue")}</p>
      )}

      {state && "error" in state && (
        <p role="alert" className="text-sm text-danger">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p data-testid="zone-scolaire-enregistree" className="text-[12px] text-kpi-green">{t("zone.enregistree")}</p>
      )}

      <Button type="submit" pending={pending} data-testid="zone-scolaire-enregistrer" className="self-start py-2 text-xs">
        {t("zone.enregistrer")}
      </Button>
    </form>
  );
}
