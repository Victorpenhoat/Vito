"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { compteARebours, formaterCode } from "../domain/lienCompte";
import { qrSvg, urlLien } from "../domain/qr";
import { Button } from "@/features/shared/ui/Button";
import { CopyButton } from "@/features/shared/ui/CopyButton";

// Le code qu'on montre : un QR pour l'appareil photo d'en face, le même code en
// clair pour ceux qui préfèrent le dicter, et le temps qu'il reste.
export function CodeLien({ code, expireLe, locale, onNouveau }: {
  code: string;
  expireLe: string;
  locale: string;
  onNouveau: () => void;
}) {
  const t = useTranslations("famille.lien");
  // L'origine n'existe que dans le navigateur : la lire pendant le rendu
  // casserait l'hydratation (défaut rencontré au lot Voyages F).
  const [origine, setOrigine] = useState("");
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valeur navigateur, lue après hydratation
    setOrigine(window.location.origin);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { expire, restant } = compteARebours(expireLe, maintenant);
  const url = origine ? urlLien(origine, locale, code) : "";
  const svg = useMemo(() => (url ? qrSvg(url) : null), [url]);

  if (expire) {
    return (
      <div data-testid="code-lien-expire" className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface p-6 text-center">
        <p className="text-[13px] text-muted">{t("expire")}</p>
        <Button type="button" onClick={onNouveau}>{t("nouveauCode")}</Button>
      </div>
    );
  }

  return (
    <div data-testid="code-lien" className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-6">
      <p className="text-center text-[12.5px] text-muted">{t("montrez")}</p>

      <div
        role="img"
        aria-label={t("qrAlt")}
        data-testid="code-lien-qr"
        className="w-full max-w-[220px] rounded-card bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
        // SVG produit localement par qrcode-generator : aucune donnée tierce,
        // aucun script — la CSP n'a rien à y redire.
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />

      <p data-testid="code-lien-code" className="font-mono text-2xl font-semibold tracking-[0.2em] text-ink">
        {formaterCode(code)}
      </p>

      <div className="flex items-center gap-2">
        <p data-testid="code-lien-reste" className="text-[12px] text-muted">{t("expireDans", { temps: restant })}</p>
        {url && <CopyButton value={url} label={t("copierLien")} />}
      </div>
    </div>
  );
}
