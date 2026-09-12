"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { lierAvecCode } from "../data/lienActions";
import { relationInverse } from "../domain/lienCompte";
import { RELATIONS, type Relation } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { Select } from "@/features/shared/ui/Select";

// Côté receveur : la relation est PRÉ-REMPLIE par l'inverse de celle qu'a
// choisie l'émetteur, mais reste modifiable — l'inverse de « fille », c'est
// père ou mère, et le genre ne se devine pas.
export function AccepterLien({ code, relationProposee }: { code: string; relationProposee: Relation | null }) {
  const t = useTranslations("famille.lien");
  const tr = useTranslations("famille.relations");
  const router = useRouter();
  const suggeree = (relationProposee && relationInverse(relationProposee)) || "conjoint";
  const [relation, setRelation] = useState<Relation>(suggeree);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lier() {
    setEnCours(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("code", code);
    fd.set("relation", relation);
    const res = await lierAvecCode(undefined, fd);
    setEnCours(false);
    if (!("ok" in res) || !res.ok) {
      setErreur(("error" in res && res.error) || t("echec"));
      return;
    }
    router.push("/famille");
  }

  return (
    <div data-testid="accepter-lien" className="flex flex-col gap-3">
      <Select label={t("vousEtes")} data-testid="accepter-relation" value={relation}
        onChange={(e) => setRelation(e.target.value as Relation)}>
        {RELATIONS.filter((r) => r !== "moi").map((r) => (
          <option key={r} value={r}>{tr(r)}</option>
        ))}
      </Select>
      {erreur && <p role="alert" className="text-[12.5px] text-danger">{erreur}</p>}
      <Button type="button" data-testid="accepter-valider" pending={enCours} onClick={lier}>
        {t("seLier")}
      </Button>
    </div>
  );
}
