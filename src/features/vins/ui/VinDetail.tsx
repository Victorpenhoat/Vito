import { getVinDetail } from "../data/queries";
import { getMerchantProvider } from "@/lib/services/merchant";
import { couleurTint } from "../domain/couleurTint";
import { BuyButton } from "./BuyButton";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { getTranslations } from "next-intl/server";

export async function VinDetail({ id }: { id: string }) {
  const t = await getTranslations("vins");
  const { vin, degustations } = await getVinDetail(id);
  const merchantUrl = getMerchantProvider().buyUrl(
    { nom: vin.nom, domaine: vin.domaine, millesime: vin.millesime, couleur: vin.couleur },
    1,
  );
  const buyUrl = vin.achat_url ?? merchantUrl;
  const eyebrow = [vin.region, vin.couleur ? t(`couleurs.${vin.couleur}`) : null].filter(Boolean).join(" · ");
  const infos: { label: string; value: string }[] = [
    ...(vin.millesime ? [{ label: t("millesime"), value: String(vin.millesime) }] : []),
    ...(vin.cepages?.length ? [{ label: t("cepages"), value: vin.cepages.join(", ") }] : []),
    ...(vin.region ? [{ label: t("region"), value: vin.region }] : []),
    ...(vin.domaine ? [{ label: t("domaine"), value: vin.domaine }] : []),
  ];
  return (
    <article className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-card">
        <div className="h-44 md:h-56" style={{ background: couleurTint(vin.couleur) }} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 text-white">
          {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">{eyebrow}</div>}
          <h1 className="font-serif text-3xl font-medium md:text-4xl">{vin.nom}{vin.millesime ? ` ${vin.millesime}` : ""}</h1>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <BuyButton url={buyUrl} />
          <section>
            <SectionLabel>{t("mesDegustations")}</SectionLabel>
            <ul>
              {degustations.map((d) => (
                <li key={d.id} data-testid="degustation-row" className="border-b border-line-soft py-2 text-sm">
                  <span className="text-muted">{d.deguste_le}</span>
                  {d.note ? <span className="text-accent"> · {d.note}/5</span> : ""}
                  {d.prix_paye ? <span className="text-ink"> · {d.prix_paye}€</span> : ""}
                  {d.commentaire ? <span className="text-muted"> {d.commentaire}</span> : ""}
                </li>
              ))}
            </ul>
          </section>
        </div>
        {infos.length > 0 && (
          <aside>
            <Card>
              <SectionLabel>{t("fiche")}</SectionLabel>
              <dl className="flex flex-col gap-2 text-sm">
                {infos.map((i) => (
                  <div key={i.label} className="flex justify-between gap-3 border-b border-line-soft pb-2 last:border-0 last:pb-0">
                    <dt className="text-muted">{i.label}</dt>
                    <dd className="text-right text-ink">{i.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </aside>
        )}
      </div>
    </article>
  );
}
