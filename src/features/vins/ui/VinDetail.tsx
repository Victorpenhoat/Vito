import { getVinDetail } from "../data/queries";
import { getMerchantProvider } from "@/lib/services/merchant";
import { BuyButton } from "./BuyButton";
import { getTranslations } from "next-intl/server";

export async function VinDetail({ id }: { id: string }) {
  const t = await getTranslations("vins");
  const { vin, degustations } = await getVinDetail(id);
  const merchantUrl = getMerchantProvider().buyUrl(
    { nom: vin.nom, domaine: vin.domaine, millesime: vin.millesime, couleur: vin.couleur },
    1,
  );
  const buyUrl = vin.achat_url ?? merchantUrl;
  return (
    <article className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">{vin.nom} {vin.millesime ? `(${vin.millesime})` : ""}</h1>
        <p className="text-gray-600">
          {[vin.domaine, vin.region, vin.couleur ? t(`couleurs.${vin.couleur}`) : null].filter(Boolean).join(" · ")}
        </p>
        {vin.cepages?.length > 0 && <p className="text-gray-500">{vin.cepages.join(", ")}</p>}
      </header>
      <BuyButton url={buyUrl} />
      <section>
        <h2 className="font-semibold">{t("title")}</h2>
        <ul>
          {degustations.map((d) => (
            <li key={d.id} data-testid="degustation-row" className="border-b py-1">
              {d.deguste_le} {d.note ? `· ${d.note}/5` : ""} {d.prix_paye ? `· ${d.prix_paye}€` : ""} {d.commentaire ?? ""}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
