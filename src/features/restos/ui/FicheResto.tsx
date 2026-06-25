import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { getFiche, getTagsForCategory } from "../data/queries";
import { FavoriteToggle } from "./FavoriteToggle";
import { AvisForm } from "./AvisForm";
import { TagPicker } from "./TagPicker";
import { getPlacesProvider } from "@/lib/services/places";
import { DegustationForm } from "@/features/vins/ui/DegustationForm";
import { getIsPremium } from "@/features/abonnement/data/queries";
import { DemandeRestoForm } from "@/features/conciergerie/ui/DemandeRestoForm";
import { Link } from "@/lib/i18n/routing";
import { getMaFamille } from "@/features/famille/data/queries";
import { AjouterFamilleButton } from "@/features/famille/ui/AjouterFamilleButton";

export async function FicheResto({ etablissementId }: { etablissementId: string }) {
  const t = await getTranslations("restos");
  const tv = await getTranslations("vins");
  const [{ etab, item, avis, appliedTagIds }, tags] = await Promise.all([
    getFiche(etablissementId),
    getTagsForCategory("restaurant"),
  ]);
  if (!etab) return <p>{t("notFound")}</p>;

  const tc = await getTranslations("conciergerie");
  const isPremium = await getIsPremium();
  const maFamille = await getMaFamille();

  let photoRefs: string[] = [];
  if (etab.place_id) {
    try {
      const details = await getPlacesProvider().details(etab.place_id);
      photoRefs = (details?.photoRefs ?? []).slice(0, 3);
    } catch {
      photoRefs = [];
    }
  }

  return (
    <article className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{etab.nom}</h1>
        <p className="text-muted">{etab.type} — {etab.adresse} {etab.arrondissement ?? ""}</p>
        {etab.telephone && <p>{etab.telephone}</p>}
      </header>
      {photoRefs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {photoRefs.map((ref) => (
            <Image
              key={ref}
              src={`/api/places/photo?ref=${encodeURIComponent(ref)}&w=400`}
              alt={etab.nom}
              width={400}
              height={267}
              className="rounded object-cover"
              data-testid="resto-photo"
            />
          ))}
        </div>
      )}
      {item && <FavoriteToggle listeItemId={item.id} isFavorite={item.is_favorite} />}
      {item && tags.length > 0 && (
        <TagPicker tags={tags} appliedTagIds={appliedTagIds} listeItemId={item.id} />
      )}
      <section>
        <h2 className="font-semibold">{t("avis")}</h2>
        <ul>{avis.map((a) => <li key={a.id} className="border-b border-line py-1 text-muted">{a.note ? `${a.note}/5 — ` : ""}{a.commentaire}</li>)}</ul>
        <AvisForm etablissementId={etab.id} />
      </section>
      <section>
        <h2 className="font-semibold">{tv("degustesIci")}</h2>
        <DegustationForm etablissementId={etab.id} />
      </section>
      <section>
        <h2 className="font-semibold">{tc("demander")}</h2>
        {isPremium ? (
          <DemandeRestoForm etablissementId={etab.id} />
        ) : (
          <p data-testid="conciergerie-premium-cta">
            {tc("premiumRequis")}{" "}
            <Link href="/abonnement" className="text-accent hover:underline">{tc("passerPremium")}</Link>
          </p>
        )}
      </section>
      {maFamille && (
        <section>
          <AjouterFamilleButton etablissementId={etab.id} />
        </section>
      )}
    </article>
  );
}
