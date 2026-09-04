"use client";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { setOrigine } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";
import { Avatar } from "@/features/shared/ui/Avatar";

export type ProcheSuggestion = { id: string; nom: string; couleur: string | null };

// « D'où vient cette adresse ? » (design Onglet_Resto_v2, écran 9) :
// Recommandation (par qui — suggestions depuis le Cercle) ou Trouvé par moi (source).
export function OrigineForm({
  listeItemId,
  initial,
  proches,
  onDone,
}: {
  listeItemId: string;
  initial?: { type: "reco" | "trouve" | "voyage" | null; qui: string | null; source: string | null };
  proches: ProcheSuggestion[];
  onDone?: () => void;
}) {
  const t = useTranslations("restos");
  const [state, action, pending] = useActionState(setOrigine, undefined);
  // Le formulaire ne propose que « recommandé » et « trouvé » : une origine
  // « voyage » est posée par une réservation, jamais choisie à la main. La
  // modifier revient donc à la remplacer par l'une des deux.
  const [type, setType] = useState<"reco" | "trouve">(
    initial?.type === "trouve" ? "trouve" : "reco",
  );
  const [qui, setQui] = useState(initial?.qui ?? "");
  const [fmId, setFmId] = useState<string>("");

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone?.();
  }, [state, onDone]);

  const suggestions = proches.filter(
    (p) => qui.trim() === "" || p.nom.toLowerCase().includes(qui.trim().toLowerCase()),
  ).slice(0, 4);

  return (
    <form action={action} data-testid="origine-form" className="flex flex-col gap-3.5">
      <input type="hidden" name="listeItemId" value={listeItemId} />
      <input type="hidden" name="origineType" value={type} />
      <input type="hidden" name="origineFamilyMemberId" value={fmId} />

      <div className="flex gap-2">
        <button type="button" aria-pressed={type === "reco"} onClick={() => setType("reco")}
          className={`flex-1 rounded-[6px] border px-3.5 py-3 text-left focus-visible:outline-2 focus-visible:outline-accent ${
            type === "reco" ? "border-kpi-amber bg-kpi-amber-bg" : "border-line bg-surface"
          }`}>
          <span className="block text-[13px] font-semibold text-ink">{t("origines.reco")}</span>
          <span className="mt-0.5 block text-[11px] text-faint">{t("origines.recoSous")}</span>
        </button>
        <button type="button" aria-pressed={type === "trouve"} onClick={() => setType("trouve")}
          className={`flex-1 rounded-[6px] border px-3.5 py-3 text-left focus-visible:outline-2 focus-visible:outline-accent ${
            type === "trouve" ? "border-kpi-amber bg-kpi-amber-bg" : "border-line bg-surface"
          }`}>
          <span className="block text-[13px] font-semibold text-ink">{t("origines.trouve")}</span>
          <span className="mt-0.5 block text-[11px] text-faint">{t("origines.trouveSous")}</span>
        </button>
      </div>

      {type === "reco" ? (
        <div className="flex flex-col gap-2">
          <Input label={t("origines.par")} name="origineQui" value={qui}
            onChange={(e) => { setQui(e.target.value); setFmId(""); }} />
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((p) => (
                <button key={p.id} type="button" onClick={() => { setQui(p.nom); setFmId(p.id); }}
                  aria-pressed={fmId === p.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 pl-1 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-accent ${
                    fmId === p.id ? "border-accent/40 bg-accent-50" : "border-line bg-surface-hover"
                  }`}>
                  <Avatar name={p.nom} size="sm" color={p.couleur ?? undefined} />
                  {p.nom} {t("origines.cercleSuffixe")}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Input label={t("origines.source")} name="origineSource" defaultValue={initial?.source ?? ""}
          placeholder={t("origines.sourcePlaceholder")} />
      )}

      {state && "error" in state && state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" pending={pending}>{t("origines.enregistrer")}</Button>
    </form>
  );
}
