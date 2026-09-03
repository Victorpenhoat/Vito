import { getTranslations } from "next-intl/server";

// Équipements « données fournisseur » (design Hôtels v2 écran 6) : ✓ / ✗ par
// équipement, visuellement distingués de MES tags. Un équipement absent de la
// réponse Places (null) n'est pas affiché : information non fournie ≠ absence.
const CLES = ["breakfast", "parking", "accessibility", "goodForChildren", "allowsDogs"] as const;

export async function EquipementsBlock({ equipements }: { equipements: Record<string, boolean | null> | null }) {
  const t = await getTranslations("hotels");
  const connus = CLES.filter((k) => typeof equipements?.[k] === "boolean");
  if (connus.length === 0) return null;
  return (
    <section data-testid="equipements-block" className="rounded-[5px] border border-line bg-surface px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("equipements.titre")}</span>
        <span className="text-[10px] text-faint">{t("equipements.fournisseur")}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1.5">
        {connus.map((k) => {
          const oui = equipements?.[k] === true;
          return (
            <li key={k} className={`text-[11.5px] ${oui ? "text-muted" : "text-faint line-through decoration-faint/50"}`}>
              {oui ? "✓" : "✗"} {t(`equipements.${k}`)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
