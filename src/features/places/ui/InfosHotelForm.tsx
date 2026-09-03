"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setInfosHotel } from "@/features/restos/data/actions";
import { Button } from "@/features/shared/ui/Button";

// Infos hôtel saisies par l'utilisateur (design Hôtels v2 écran 6 : étoiles,
// prix indicatif/nuit, check-in/check-out). Google Places ne les fournit pas —
// ce bloc est explicitement « saisi par moi », face au bloc Équipements
// « données fournisseur ».
export function InfosHotelForm({ listeItemId, etoiles, prixNuit, checkin, checkout }: {
  listeItemId: string;
  etoiles: number | null;
  prixNuit: number | null;
  checkin: string | null;
  checkout: string | null;
}) {
  const t = useTranslations("hotels");
  const [state, action, pending] = useActionState(setInfosHotel, undefined);
  // colonne `time` → "15:00:00" ; l'input time attend "HH:MM"
  const hhmm = (v: string | null) => (v ? v.slice(0, 5) : "");

  return (
    <form action={action} data-testid="infos-hotel-form" className="flex flex-col gap-3 rounded-[5px] border border-line bg-surface px-3.5 py-3">
      <input type="hidden" name="listeItemId" value={listeItemId} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("infos.titre")}</span>
        <span className="text-[10px] text-faint">{t("infos.saisies")}</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <label className="flex min-w-[86px] flex-1 flex-col gap-1 text-[11px] text-muted">
          {t("infos.etoiles")}
          <select name="etoiles" defaultValue={etoiles ?? ""} data-testid="infos-etoiles"
            aria-label={t("infos.etoiles")}
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent">
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
          </select>
        </label>
        <label className="flex min-w-[96px] flex-1 flex-col gap-1 text-[11px] text-muted">
          {t("infos.prixNuit")}
          <input type="number" name="prixNuit" min={0} step="0.01" defaultValue={prixNuit ?? ""}
            data-testid="infos-prix-nuit" aria-label={t("infos.prixNuit")}
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
        </label>
        <label className="flex min-w-[86px] flex-1 flex-col gap-1 text-[11px] text-muted">
          {t("infos.checkin")}
          <input type="time" name="checkinHeure" defaultValue={hhmm(checkin)} aria-label={t("infos.checkin")}
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
        </label>
        <label className="flex min-w-[86px] flex-1 flex-col gap-1 text-[11px] text-muted">
          {t("infos.checkout")}
          <input type="time" name="checkoutHeure" defaultValue={hhmm(checkout)} aria-label={t("infos.checkout")}
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
        </label>
      </div>
      {state && "error" in state && state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" pending={pending} className="self-start py-2 text-xs">{t("infos.enregistrer")}</Button>
    </form>
  );
}
