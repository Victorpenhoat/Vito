import { Link } from "@/lib/i18n/routing";
import { Badge } from "@/features/shared/ui/Badge";
import type { Place } from "../domain/filterPlaces";

export function PlaceCard({ place }: { place: Place }) {
  const { etablissement, tags, is_favorite } = place;
  const subtitle = [etablissement.type, etablissement.ville].filter(Boolean).join(" · ");
  const photoUrl = etablissement.photo_ref
    ? `/api/places/photo?ref=${encodeURIComponent(etablissement.photo_ref)}&w=800`
    : null;
  const initial = etablissement.nom.charAt(0).toUpperCase();

  return (
    <li data-testid="place-card">
      <Link
        href={`/restos/${etablissement.id}`}
        className="block overflow-hidden rounded-card border border-line bg-surface"
      >
        <div className="relative h-40 bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={etablissement.nom} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-serif text-4xl text-faint">{initial}</span>
          )}
          {is_favorite && (
            <span aria-label="favori" className="absolute right-3 top-3 text-lg text-gold drop-shadow">★</span>
          )}
        </div>
        <div className="flex flex-col gap-1 p-4">
          {etablissement.type && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{etablissement.type}</span>
          )}
          <span className="font-serif text-xl font-medium text-ink">{etablissement.nom}</span>
          {subtitle && <span className="text-sm text-muted">{etablissement.ville}</span>}
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag.slug} style={tag.color ? { backgroundColor: tag.color } : undefined} className={tag.color ? "text-white" : ""}>
                  {tag.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
