"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { Modal } from "@/features/shared/ui/Modal";
import { Button } from "@/features/shared/ui/Button";
import { recommanderAdresse, recommanderVin } from "../data/actions";
import { destinatairesPossibles } from "../domain/reception";

type Proche = { id: string; nom: string; profileId: string | null };

/** Ce qu'on recommande : une adresse (référencée chez le fournisseur) ou un vin
 *  (décrit, puisqu'il n'a pas de fournisseur derrière lui). */
export type Cible =
  | { type: "adresse"; categorie: "resto" | "hotel"; placeId: string; libelle: string }
  | {
      type: "vin"; libelle: string; nom: string;
      domaine?: string | null; millesime?: number | null;
      couleur?: string | null; region?: string | null;
    };

// « Recommander à… » depuis une fiche. Ne s'affiche que si quelqu'un peut
// recevoir : un proche sans compte rattaché n'a pas de boîte.
export function RecommanderButton({ proches, cible }: {
  proches: Proche[];
  cible: Cible;
}) {
  const libelle = cible.libelle;
  const t = useTranslations("reception");
  const [ouvert, setOuvert] = useState(false);
  const [mot, setMot] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [envoyeA, setEnvoyeA] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const destinataires = destinatairesPossibles(proches);
  if (destinataires.length === 0) return null;

  async function envoyer(familyMemberId: string) {
    setEnCours(familyMemberId);
    setErreur(null);
    const fd = new FormData();
    fd.set("familyMemberId", familyMemberId);
    fd.set("libelle", cible.libelle);
    if (mot.trim()) fd.set("mot", mot.trim());
    if (cible.type === "adresse") {
      fd.set("categorie", cible.categorie);
      fd.set("placeId", cible.placeId);
    } else {
      fd.set("nom", cible.nom);
      if (cible.domaine) fd.set("domaine", cible.domaine);
      if (cible.millesime != null) fd.set("millesime", String(cible.millesime));
      if (cible.couleur) fd.set("couleur", cible.couleur);
      if (cible.region) fd.set("region", cible.region);
    }
    const res = cible.type === "adresse"
      ? await recommanderAdresse(undefined, fd)
      : await recommanderVin(undefined, fd);
    setEnCours(null);
    if (!("ok" in res) || !res.ok) {
      setErreur(("error" in res && res.error) || t("echec"));
      return;
    }
    setEnvoyeA((l) => [...l, familyMemberId]);
  }

  return (
    <>
      <button type="button" data-testid="recommander" onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-hover px-3.5 py-1.5 text-[11.5px] font-semibold text-ink hover:border-accent/30 focus-visible:outline-2 focus-visible:outline-accent">
        <Send size={12} className="text-accent" aria-hidden />
        {t("recommander")}
      </button>

      <Modal open={ouvert} onClose={() => setOuvert(false)} title={t("recommanderTitre", { nom: libelle })}>
        <div data-testid="recommander-form" className="flex flex-col gap-3">
          {erreur && <p role="alert" className="text-[12px] text-danger">{erreur}</p>}
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            {t("mot")}
            <input value={mot} onChange={(e) => setMot(e.target.value)} data-testid="recommander-mot"
              placeholder={t("motPlaceholder")} aria-label={t("mot")}
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:outline-2 focus:outline-accent" />
          </label>

          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("aQui")}</span>
          <ul className="flex flex-col">
            {destinataires.map((p) => (
              <li key={p.id} className="flex items-center gap-2 border-b border-line-soft py-2">
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{p.nom}</span>
                {envoyeA.includes(p.id) ? (
                  <span data-testid="recommander-envoye" className="rounded-full bg-kpi-green-bg px-2.5 py-1 text-[10.5px] font-semibold text-kpi-green">
                    {t("envoye")}
                  </span>
                ) : (
                  <Button type="button" variant="ghost" data-testid={`recommander-a-${p.id}`}
                    pending={enCours === p.id} onClick={() => envoyer(p.id)}>
                    {t("envoyer")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[10.5px] text-faint">{t("aide")}</p>
        </div>
      </Modal>
    </>
  );
}
