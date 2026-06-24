import { getVinDetail } from "../data/queries";
import { getMerchantProvider } from "@/lib/services/merchant";
import { BuyButton } from "./BuyButton";
import { Card } from "@/features/shared/ui/Card";
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
      <Card>
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-ink">{vin.nom} {vin.millesime ? `(${vin.millesime})` : ""}</h1>
          <p className="text-muted">
            {[vin.domaine, vin.region, vin.couleur ? t(`couleurs.${vin.couleur}`) : null].filter(Boolean).join(" · ")}
          </p>
          {vin.cepages?.length > 0 && <p className="text-faint">{vin.cepages.join(", ")}</p>}
        </header>
      </Card>
      <BuyButton url={buyUrl} />
      <section>
        <h2 className="font-semibold text-ink">{t("title")}</h2>
        <ul>
          {degustations.map((d) => (
            <li key={d.id} data-testid="degustation-row" className="border-b border-line py-2">
              <span className="text-muted">{d.deguste_le}</span>
              {d.note ? <span className="text-accent"> · {d.note}/5</span> : ""}
              {d.prix_paye ? <span className="text-ink"> · {d.prix_paye}€</span> : ""}
              {d.commentaire ? <span className="text-muted"> {d.commentaire}</span> : ""}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
