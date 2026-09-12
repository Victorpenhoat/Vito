"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { normaliserCode } from "../domain/lienCompte";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";

// L'autre bout du même geste : celui qui n'a pas scanné tape le code.
// La saisie est normalisée ici (minuscules, tiret, espaces) — la base, elle,
// ne connaît que la forme canonique.
export function SaisirCodeForm() {
  const t = useTranslations("famille.lien");
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <form
      data-testid="saisir-code"
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const saisie = new FormData(e.currentTarget).get("code");
        const code = normaliserCode(String(saisie ?? ""));
        if (!code) { setErreur(t("codeInvalide")); return; }
        setErreur(null);
        router.push(`/lier/${code}`);
      }}
    >
      <div className="flex items-end gap-2">
        {/* le wrapper label/erreur d'Input est un <label> en colonne : c'est LUI
            qui doit s'étirer, pas le champ. */}
        <div className="flex-1">
          <Input
            name="code"
            label={t("saisirCode")}
            placeholder="7K4P-2M9X"
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full font-mono uppercase"
          />
        </div>
        <Button type="submit" variant="ghost">{t("continuer")}</Button>
      </div>
      {erreur && <p role="alert" className="text-[12px] text-danger">{erreur}</p>}
    </form>
  );
}
