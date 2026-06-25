import { Card } from "@/features/shared/ui/Card";
import { Badge } from "@/features/shared/ui/Badge";
import { Link } from "@/lib/i18n/routing";
import type { Place } from "../domain/filterPlaces";

export function PlaceCard({ place }: { place: Place }) {
  const { etablissement, tags, is_favorite } = place;
  const subtitle = [etablissement.type, etablissement.ville].filter(Boolean).join(" · ");

  return (
    <li data-testid="place-card">
      <Card>
        <Link href={`/restos/${etablissement.id}`} className="flex flex-col gap-1">
          <span className="text-base font-semibold text-ink">
            {etablissement.nom}
            {is_favorite && (
              <span aria-label="favori" className="ml-1 text-amber-400">
                ★
              </span>
            )}
          </span>
          {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge
                  key={tag.slug}
                  style={tag.color ? { backgroundColor: tag.color } : undefined}
                  className={tag.color ? "text-white" : ""}
                >
                  {tag.label}
                </Badge>
              ))}
            </div>
          )}
        </Link>
      </Card>
    </li>
  );
}
