import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { formatDay } from "@/lib/format/date";
import { getVinsBusIci, getVinsConnus } from "../data/queries";
import { getTagsForCategory } from "@/features/restos/data/queries";
import { VerresLecture } from "./NoteVerres";
import { AjouterVinButton } from "./AjouterVinButton";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

// « Vins bus ici » (design Vins & Cave écran 8) : sur la fiche d'un restaurant.
// « Ajouter un vin » crée une dégustation liée à l'établissement, SANS exiger
// une visite — boire un verre au comptoir n'est pas y avoir dîné.
export async function VinsBusIci({ etablissementId, etablissementNom }: {
  etablissementId: string;
  etablissementNom: string;
}) {
  const t = await getTranslations("vins");
  const locale = await getLocale();
  const [vins, vinsConnus, tags] = await Promise.all([
    getVinsBusIci(etablissementId),
    getVinsConnus(),
    getTagsForCategory("vin"),
  ]);

  return (
    <section data-testid="vins-bus-ici" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>
          {t("busIci.titre")}
          {vins.length > 0 && <span className="ml-1 text-faint">· {vins.length}</span>}
        </SectionLabel>
        <AjouterVinButton vinsConnus={vinsConnus} tags={tags}
          etablissementId={etablissementId} etablissementNom={etablissementNom} />
      </div>

      {vins.length === 0 ? (
        <p data-testid="vins-bus-ici-vide" className="text-[12.5px] text-muted">{t("busIci.vide")}</p>
      ) : (
        <ul className="flex flex-col">
          {vins.map((v) => (
            <li key={v.id} data-testid="vin-bu-ici" className="border-b border-line-soft last:border-0">
              <Link href={`/vins/${v.vinId}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-hover">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">
                    {[v.intitule, v.detail].filter(Boolean).join(" · ")}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted">
                    {[
                      formatDay(v.degusteLe, locale),
                      v.prix != null ? `${v.prix} € ${v.unite ? t(`unites.${v.unite}`).toLowerCase() : ""}`.trim() : null,
                      // Dit explicitement : sinon on chercherait la visite correspondante.
                      v.sansVisite ? t("busIci.sansVisite") : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <VerresLecture note={v.note} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
