"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check, X, Utensils, Hotel, Wine } from "lucide-react";
import { useRouter } from "@/lib/i18n/routing";
import { accepterRecommandation, refuserRecommandation } from "../data/actions";
import { trierReception, dejaAuCarnet, type Recommandation } from "../domain/reception";

// Ma boîte (lot 2). Accepter fait entrer l'adresse au carnet avec son origine
// déjà remplie ; refuser la retire d'ici, et l'expéditeur n'en saura rien —
// décision PO, on ne froisse personne.
export function ReceptionList({ boite, placeIdsDuCarnet }: {
  boite: Recommandation[];
  placeIdsDuCarnet: string[];
}) {
  const t = useTranslations("reception");
  const format = useFormatter();
  const router = useRouter();
  const [traitees, setTraitees] = useState<string[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const visibles = trierReception(boite).filter((r) => !traitees.includes(r.id));

  async function traiter(id: string, quoi: "accepter" | "refuser") {
    setEnCours(id);
    setErreur(null);
    const fd = new FormData();
    fd.set("recommandationId", id);
    const res = quoi === "accepter"
      ? await accepterRecommandation(undefined, fd)
      : await refuserRecommandation(undefined, fd);
    setEnCours(null);
    if (!("ok" in res) || !res.ok) {
      setErreur(("error" in res && res.error) || t("echec"));
      return;
    }
    // La carte disparaît tout de suite : le rafraîchissement RSC ne se commet
    // pas toujours sous charge (#71/#77), et une carte qui reste après un clic
    // ferait douter de ce qui a été fait.
    setTraitees((l) => [...l, id]);
    router.refresh();
  }

  if (visibles.length === 0) {
    return (
      <div data-testid="reception-vide" className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="font-serif text-lg text-ink">{t("videTitre")}</p>
        <p className="max-w-sm text-[12.5px] text-muted">{t("videTexte")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {erreur && <p role="alert" className="text-[12px] text-danger">{erreur}</p>}
      <ul className="flex flex-col gap-2.5">
        {visibles.map((r) => {
          const Icone = r.categorie === "hotel" ? Hotel : r.categorie === "vin" ? Wine : Utensils;
          const connue = dejaAuCarnet(r, placeIdsDuCarnet);
          return (
            <li key={r.id} data-testid="reco-row" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5">
              <div className="flex items-start gap-2.5">
                <Icone size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-base text-ink">{r.libelle}</p>
                  <p className="text-[11.5px] text-muted">
                    {t("de", { nom: r.deNom })} · {format.dateTime(new Date(r.creeLe), { dateStyle: "medium" })}
                  </p>
                  {r.mot && <p className="mt-1 text-[12.5px] text-ink">« {r.mot} »</p>}
                  {connue && (
                    // Le dire AVANT d'accepter : sinon on croit ajouter une
                    // adresse neuve et on ne comprend pas qu'il ne se passe rien.
                    <p data-testid="reco-deja-connue" className="mt-1 text-[11px] font-semibold text-kpi-amber">
                      {t("dejaAuCarnet")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" data-testid="reco-accepter" disabled={enCours === r.id}
                  onClick={() => traiter(r.id, "accepter")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[11.5px] font-semibold text-app focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">
                  <Check size={12} aria-hidden />
                  {t("accepter")}
                </button>
                <button type="button" data-testid="reco-refuser" disabled={enCours === r.id}
                  onClick={() => traiter(r.id, "refuser")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-hover px-3.5 py-1.5 text-[11.5px] font-semibold text-muted focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">
                  <X size={12} aria-hidden />
                  {t("refuser")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
