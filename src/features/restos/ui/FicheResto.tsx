import { getTranslations, getLocale } from "next-intl/server";
import { getFiche, getTagsForCategory } from "../data/queries";
import { restoStatut } from "../domain/statut";
import { ArchiveToggle } from "./ArchiveToggle";
import { TagPicker } from "./TagPicker";
import { PhotoCacheSync } from "./PhotoCacheSync";
import { StatutChip } from "./StatutChip";
import { VisiteCta } from "./VisiteCta";
import { OrigineBlock } from "./OrigineBlock";
import { EquipementsBlock } from "@/features/places/ui/EquipementsBlock";
import { InfosHotelForm } from "@/features/places/ui/InfosHotelForm";
import { getMesVoyages } from "@/features/voyages/data/queries";
import { getPlacesProvider } from "@/lib/services/places";
import { getProches } from "@/features/famille/data/queries";
import { formatDay } from "@/lib/format/date";
import { DegustationForm } from "@/features/vins/ui/DegustationForm";
import { getIsPremium } from "@/features/abonnement/data/queries";
import { DemandeRestoForm } from "@/features/conciergerie/ui/DemandeRestoForm";
import { Link } from "@/lib/i18n/routing";
import { getMaFamille } from "@/features/famille/data/queries";
import { AjouterFamilleButton } from "@/features/famille/ui/AjouterFamilleButton";

/** Nuits entre deux dates ISO (séjour) — null si la plage est incomplète. */
function nuitsEntre(debut: string | null, fin: string | null): number | null {
  if (!debut || !fin) return null;
  const n = Math.round((Date.parse(fin) - Date.parse(debut)) / 86_400_000);
  return n > 0 ? n : null;
}

// Fiche restaurant v2 (design Onglet_Resto_v2, écran 6) : statut modifiable,
// bloc pratique (données Places), « Pourquoi c'est là », « Mes visites ».
// Partagée avec les hôtels (category="hotel") — Hôtels v2 (écran 6) : mêmes
// blocs + équipements fournisseur, infos perso et séjours datés/voyage lié.
export async function FicheResto({ etablissementId, category = "restaurant" }: { etablissementId: string; category?: "restaurant" | "hotel" }) {
  const t = await getTranslations("restos");
  const th = await getTranslations("hotels");
  const tv = await getTranslations("vins");
  const locale = await getLocale();
  const [{ etab, item, avis, appliedTagIds, visites }, tags] = await Promise.all([
    getFiche(etablissementId),
    getTagsForCategory(category),
  ]);
  if (!etab) return <p>{t("notFound")}</p>;

  const isResto = category === "restaurant";
  // Hôtels v2 : le libellé de statut/visite vient du namespace `hotels`
  const tCat = isResto ? t : th;
  // Voyages du user : proposés en liaison automatique dans le formulaire de séjour.
  const voyages = isResto ? [] : (await getMesVoyages()).map((v) => ({
    id: v.id, titre: v.titre, date_debut: v.date_debut, date_fin: v.date_fin,
  }));
  const tc = await getTranslations("conciergerie");
  const isPremium = await getIsPremium();
  const maFamille = await getMaFamille();
  // Suggestions Cercle pour l'origine — les deux catégories depuis Hôtels v2.
  const proches = item
    ? (await getProches()).map((p) => ({ id: p.id, nom: `${p.first_name} ${p.last_name}`, couleur: p.avatar_color }))
    : [];

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

  const prix = etab.price_level ? "€".repeat(Math.max(1, Math.min(4, etab.price_level))) : null;
  const fmtPrix = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  // Hôtel : type d'hébergement + étoiles saisies + ville + prix/nuit indicatif ;
  // resto : type de cuisine + fourchette de prix + quartier (inchangé).
  const sousTitre = isResto
    ? [etab.type, prix, etab.arrondissement ?? etab.ville].filter(Boolean).join(" · ")
    : [
        etab.type_hebergement ? th(`types.${etab.type_hebergement}`) : null,
        item?.etoiles ? "★".repeat(item.etoiles) : null,
        etab.arrondissement ?? etab.ville,
        item?.prix_nuit != null ? `≈ ${fmtPrix(Number(item.prix_nuit))} ${th("infos.parNuit")}` : null,
      ].filter(Boolean).join(" · ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([etab.nom, etab.adresse ?? etab.ville ?? ""].filter(Boolean).join(" "))}`;
  const fmtNote = (n: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
  const statut = item ? restoStatut(item) : null;

  return (
    <article className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-card bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
        {heroRef && (
          // proxy privé no-store à query dynamique : localPatterns.search exige une chaîne
          // exacte depuis Next 16 (next/image crashait la fiche en dev) — même choix que
          // PlaceCard/VoyageCover.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/places/photo?ref=${encodeURIComponent(heroRef)}&w=1200`}
            alt={etab.nom}
            className="h-56 w-full object-cover md:h-72"
            data-testid="resto-photo"
          />
        )}
        <div className={`${heroRef ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white" : "text-ink"} p-5`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">{sousTitre}</div>
          <h1 className="font-serif text-3xl font-medium md:text-4xl">{etab.nom}</h1>
        </div>
      </div>
      {shouldSync && heroRef && <PhotoCacheSync etabId={etab.id} photoRef={heroRef} />}

      {/* statut : chip modifiable v2 pour les deux catégories (Hôtels v2 écran 6) */}
      <div className="flex flex-wrap items-center gap-2">
        {item && statut && <StatutChip listeItemId={item.id} statut={statut} categorie={isResto ? "resto" : "hotel"} />}
        {item && <ArchiveToggle listeItemId={item.id} isArchived={item.is_archived} />}
      </div>

      {item && tags.length > 0 && (
        <TagPicker tags={tags} appliedTagIds={appliedTagIds} listeItemId={item.id} />
      )}

      {/* bloc pratique — données du fournisseur, distinguées des données perso.
          Côté hôtel il est toujours rendu : check-in/out saisis et lien de
          réservation ne dépendent pas des données Places. */}
      {(etab.adresse || etab.telephone || etab.website || !isResto) && (
        <section>
          <div className="divide-y divide-line-soft overflow-hidden rounded-[5px] border border-line bg-surface">
            {etab.adresse && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                <span className="min-w-0 text-[13px] text-ink">{etab.adresse}</span>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11.5px] font-semibold text-accent hover:underline">
                  {t("pratique.maps")} ↗
                </a>
              </div>
            )}
            {etab.telephone && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                <span className="text-[13px] text-ink">{etab.telephone}</span>
                <a href={`tel:${etab.telephone}`} className="shrink-0 text-[11.5px] font-semibold text-accent hover:underline">{t("pratique.appeler")}</a>
              </div>
            )}
            {/* hôtel : check-in / check-out saisis */}
            {!isResto && (item?.checkin_heure || item?.checkout_heure) && (
              <div className="px-3.5 py-3 text-[13px] text-ink">
                {th("pratique.horaires", {
                  checkin: (item.checkin_heure ?? "—").slice(0, 5),
                  checkout: (item.checkout_heure ?? "—").slice(0, 5),
                })}
              </div>
            )}
            {etab.website && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                <span className="min-w-0 truncate text-[13px] text-ink">{etab.website.replace(/^https?:\/\/(www\.)?/, "")}</span>
                <a href={etab.website} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11.5px] font-semibold text-accent hover:underline">
                  {isResto ? t("pratique.reserver") : th("pratique.siteOfficiel")} ↗
                </a>
              </div>
            )}
            {/* hôtel : lien de réservation plateforme (recherche pré-remplie) */}
            {!isResto && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                <span className="text-[13px] text-ink">{th("pratique.reserver")}</span>
                <a
                  href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent([etab.nom, etab.ville ?? ""].filter(Boolean).join(" "))}`}
                  target="_blank" rel="noopener noreferrer"
                  data-testid="lien-booking"
                  className="shrink-0 text-[11.5px] font-semibold text-accent hover:underline"
                >
                  {th("pratique.booking")} ↗
                </a>
              </div>
            )}
          </div>
          {/* mention fournisseur seulement si des données Places sont affichées */}
          {(etab.adresse || etab.telephone || etab.website) && (
            <p className="mt-1 text-right text-[10px] text-faint">{t("pratique.donnees")}</p>
          )}
        </section>
      )}

      {/* Équipements — données fournisseur, distinctes de mes tags (hôtel) */}
      {!isResto && <EquipementsBlock equipements={etab.equipements as Record<string, boolean | null> | null} />}

      {/* Mes informations (hôtel) : étoiles, prix/nuit, check-in/out — saisies */}
      {!isResto && item && (
        <InfosHotelForm listeItemId={item.id} etoiles={item.etoiles}
          prixNuit={item.prix_nuit == null ? null : Number(item.prix_nuit)}
          checkin={item.checkin_heure} checkout={item.checkout_heure} />
      )}

      {/* Pourquoi c'est là (origine) — restos ET hôtels (Hôtels v2 écran 6) */}
      {item && (
        <OrigineBlock
          listeItemId={item.id}
          categorie={isResto ? "resto" : "hotel"}
          origine={{
            // colonne text + CHECK ('reco'|'trouve') : le type généré reste string
            type: (item.origine_type === "reco" || item.origine_type === "trouve" ? item.origine_type : null),
            qui: item.origine_qui,
            source: item.origine_source,
          }}
          proches={proches}
        />
      )}

      {/* Mes visites (resto) / Mes séjours (hôtel) — même bloc, dates en plage
          et voyage lié côté hôtel. Les avis /5 restent lisibles pour l'historique
          non migré (le formulaire d'avis a disparu : tout passe par les séjours). */}
      {item && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{tCat("visite.mesVisites")}</h2>
            <span className="text-[11px] text-faint">{tCat("visite.count", { n: visites.length })}</span>
          </div>
          {visites.length > 0 && (
            <ul className="divide-y divide-line-soft overflow-hidden rounded-[5px] border border-line bg-surface">
              {visites.map((v) => {
                const voyage = Array.isArray(v.voyage) ? v.voyage[0] : v.voyage;
                const n = !isResto ? nuitsEntre(v.visite_le, v.date_fin) : null;
                return (
                  <li key={v.id} data-testid={isResto ? "visite-row" : "sejour-row"} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <span className="min-w-0 text-[12.5px] text-ink">
                      <span className="font-medium">
                        {formatDay(v.visite_le, locale)}
                        {!isResto && v.date_fin ? ` → ${formatDay(v.date_fin, locale)}` : ""}
                      </span>
                      {n != null && <span className="text-faint"> · {th("visite.nuits", { n })}</span>}
                      {v.commentaire && <span className="text-faint"> · « {v.commentaire} »</span>}
                      {voyage && (
                        <Link href={`/voyages/${voyage.id}`} data-testid="sejour-voyage"
                          className="ml-1.5 rounded-full border border-accent/25 bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent hover:underline">
                          {th("visite.voyageLien", { titre: voyage.titre })} →
                        </Link>
                      )}
                    </span>
                    {v.note != null && <span className="shrink-0 text-[12.5px] font-semibold text-ink">{fmtNote(v.note)}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {!isResto && avis.length > 0 && (
            <ul className="text-[11.5px] text-faint">
              {avis.map((a) => <li key={a.id} className="py-0.5">{a.note ? `${a.note}/5 — ` : ""}{a.commentaire}</li>)}
            </ul>
          )}
          <VisiteCta listeItemId={item.id} nom={etab.nom} tags={tags}
            categorie={isResto ? "resto" : "hotel"} voyages={voyages} />
        </section>
      )}

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
