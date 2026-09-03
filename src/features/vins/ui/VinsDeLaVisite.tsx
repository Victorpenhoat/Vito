"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { VerresLecture } from "./NoteVerres";
import { AjouterVinButton } from "./AjouterVinButton";

type TagLite = { id: string; slug: string; label: string; color: string | null };
type VinLigne = { intitule: string; note: number | null };

// Section « Vins » du formulaire de visite (design Vins & Cave écran 1).
//
// Les vins ajoutés pendant la saisie s'affichent depuis l'état local plutôt que
// d'un rafraîchissement serveur : la visite se saisit dans une modale, et la
// recharger sous les doigts de l'utilisateur lui ferait perdre sa note et son
// commentaire. Le rattachement à la visite, lui, se fait à l'enregistrement.
export function VinsDeLaVisite({ dejaNotes, vinsConnus, tags, etablissementId, etablissementNom }: {
  dejaNotes: VinLigne[];
  vinsConnus: { id: string; cle: string; nb: number; dernier: string | null }[];
  tags: TagLite[];
  etablissementId: string;
  etablissementNom: string;
}) {
  const t = useTranslations("vins");
  const [ajoutes, setAjoutes] = useState<VinLigne[]>([]);
  const vins = [...dejaNotes, ...ajoutes];

  return (
    <section data-testid="vins-de-la-visite" className="flex flex-col gap-2 border-t border-line-soft pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
          {t("busIci.sectionVisite")}
          {vins.length > 0 && <span className="ml-1 normal-case tracking-normal">· {t("busIci.ajoutes", { n: vins.length })}</span>}
        </span>
      </div>
      {vins.length > 0 && (
        <ul className="flex flex-col gap-1">
          {vins.map((v, i) => (
            <li key={`${v.intitule}-${i}`} data-testid="vin-de-la-visite"
              className="flex items-center gap-2 rounded-[5px] border border-line bg-surface-hover px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{v.intitule || t("busIci.vinSansNom")}</span>
              <VerresLecture note={v.note} taille={11} />
            </li>
          ))}
        </ul>
      )}
      <AjouterVinButton vinsConnus={vinsConnus} tags={tags} etablissementId={etablissementId}
        etablissementNom={etablissementNom} onAjoute={(v) => setAjoutes((l) => [...l, v])} />
    </section>
  );
}
