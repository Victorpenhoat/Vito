import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { getFiche, getTagsForCategory } from "../data/queries";
import { FavoriteToggle } from "./FavoriteToggle";
import { AvisForm } from "./AvisForm";
import { TagPicker } from "./TagPicker";
import { PhotoCacheSync } from "./PhotoCacheSync";
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

  const heroRef = photoRefs[0] ?? null;
  const STALE_MS = 30 * 24 * 60 * 60 * 1000;
  const fetchedAt = etab.photo_fetched_at ? new Date(etab.photo_fetched_at).getTime() : 0;
  // eslint-disable-next-line react-hooks/purity -- Date.now() is fine in a Server Component (not a hook, no re-render)
  const shouldSync = heroRef !== null && (heroRef !== etab.photo_ref || Date.now() - fetchedAt > STALE_MS);

  return (
    <article className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-card bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
        {heroRef && (
          <Image
            src={`/api/places/photo?ref=${encodeURIComponent(heroRef)}&w=1200`}
            alt={etab.nom}
            width={1200}
            height={420}
            className="h-56 w-full object-cover md:h-72"
            data-testid="resto-photo"
          />
        )}
        <div className={`${heroRef ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white" : "text-ink"} p-5`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">
            {[etab.type, etab.arrondissement ?? etab.ville].filter(Boolean).join(" · ")}
          </div>
          <h1 className="font-serif text-3xl font-medium md:text-4xl">{etab.nom}</h1>
          {etab.telephone && <p className="mt-1 text-sm opacity-90">{etab.telephone}</p>}
        </div>
      </div>
      {shouldSync && heroRef && <PhotoCacheSync etabId={etab.id} photoRef={heroRef} />}
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
