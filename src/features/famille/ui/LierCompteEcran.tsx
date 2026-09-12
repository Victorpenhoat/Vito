"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { creerCodeLien } from "../data/lienActions";
import { RELATIONS, type Relation } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { Select } from "@/features/shared/ui/Select";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { TagChip } from "@/features/shared/ui/TagChip";
import { CodeLien } from "./CodeLien";
import { SaisirCodeForm } from "./SaisirCodeForm";

type FicheLibre = { id: string; first_name: string; last_name: string };

// Écran « se lier à un compte » : l'autre a déjà un compte Vito, on échange un
// code plutôt qu'une invitation à s'inscrire. Les relations gendrées de 00027
// sont toutes offertes SAUF « moi » : cette fiche-là ne décrit personne d'autre.
const RELATIONS_LIEN = RELATIONS.filter((r) => r !== "moi");

export function LierCompteEcran({ fiches, locale }: { fiches: FicheLibre[]; locale: string }) {
  const t = useTranslations("famille.lien");
  const tr = useTranslations("famille.relations");
  const [relation, setRelation] = useState<Relation>("conjoint");
  const [ficheId, setFicheId] = useState("");
  const [code, setCode] = useState<{ code: string; expireLe: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function obtenir() {
    setEnCours(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("relation", relation);
    if (ficheId) fd.set("familyMemberId", ficheId);
    const res = await creerCodeLien(undefined, fd);
    setEnCours(false);
    if (!("code" in res) || !res.code) {
      setErreur(("error" in res && res.error) || t("echec"));
      return;
    }
    setCode({ code: res.code, expireLe: res.expireLe });
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <p className="text-[13px] text-muted">{t("intro")}</p>

      {code ? (
        <CodeLien code={code.code} expireLe={code.expireLe} locale={locale} onNouveau={() => { setCode(null); void obtenir(); }} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span id="lier-relation-label" className="text-sm font-medium text-muted">{t("quiEst")}</span>
            {/* Chips du kit (TagChip) plutôt qu'une pastille redessinée : le
                garde-fou du lot 6B refuse une 108e copie faite main. */}
            <div role="group" aria-labelledby="lier-relation-label" className="flex flex-wrap gap-2">
              {RELATIONS_LIEN.map((r) => (
                <TagChip key={r} ton={relation === r ? "selectionne" : "defaut"}
                  testId={`lier-relation-${r}`} onClick={() => setRelation(r)}>
                  {tr(r)}
                </TagChip>
              ))}
            </div>
          </div>

          {/* Rattacher une fiche déjà au carnet plutôt qu'en créer une seconde :
              sans ce choix, se lier fabriquerait un doublon le jour du lien. */}
          {fiches.length > 0 && (
            <Select label={t("fiche")} data-testid="lier-fiche" value={ficheId}
              onChange={(e) => setFicheId(e.target.value)}>
              <option value="">{t("ficheNouvelle")}</option>
              {fiches.map((f) => (
                <option key={f.id} value={f.id}>{`${f.first_name} ${f.last_name}`.trim()}</option>
              ))}
            </Select>
          )}

          {erreur && <p role="alert" className="text-[12.5px] text-danger">{erreur}</p>}
          <Button type="button" data-testid="lier-obtenir-code" pending={enCours} onClick={obtenir}>
            {t("obtenirCode")}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <SectionLabel>{t("jaiUnCode")}</SectionLabel>
        <SaisirCodeForm />
      </div>
    </div>
  );
}
