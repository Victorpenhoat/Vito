"use client";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Badge } from "@/features/shared/ui/Badge";
import type { Place } from "../domain/filterPlaces";
import { computeNotation, chipsForVariant } from "../domain/categoryConfig";

type Variant = "liste" | "vignette";

export function PlaceCard({ place, variant = "liste" }: { place: Place; variant?: Variant }) {
  const { etablissement, tags, is_favorite } = place;
  const t = useTranslations("places");
  const format = useFormatter();
  const base = etablissement.categorie === "hotel" ? "hotels" : "restos";
  const subtitle = [etablissement.type, etablissement.ville].filter(Boolean).join(" · ");
  const photoUrl = etablissement.photo_ref
    ? `/api/places/photo?ref=${encodeURIComponent(etablissement.photo_ref)}&w=800`
    : null;
  const initial = etablissement.nom.charAt(0).toUpperCase();

  const notation = computeNotation(etablissement.categorie, etablissement.rating);
  const visibleTags = chipsForVariant(tags, etablissement.categorie, variant);
  const fmt = (v: number) => format.number(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const note = notation && (
    <span data-testid="place-note" className="inline-flex items-center gap-1 text-sm text-ink">
      {notation.kind === "stars" ? (
        <>
          <span className="text-gold">★</span>
          {fmt(notation.value)}
        </>
      ) : (
        <>
          <span className="font-semibold">{fmt(notation.value)}</span>
          <span className="text-muted">{t("noteSur10")}</span>
        </>
      )}
    </span>
  );

  const chips = visibleTags.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {visibleTags.map((tag) => (
        <Badge key={tag.slug} style={tag.color ? { backgroundColor: tag.color } : undefined} className={tag.color ? "text-white" : ""}>
          {tag.label}
        </Badge>
      ))}
    </div>
  );

  if (variant === "vignette") {
    return (
      <li data-testid="place-card">
        <Link
          href={`/${base}/${etablissement.id}`}
          data-testid="place-card-vignette"
          className="block overflow-hidden rounded-card border border-line bg-surface"
        >
          <div className="relative h-26 bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={etablissement.nom} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-serif text-3xl text-faint">{initial}</span>
            )}
            {is_favorite && (
              <span aria-label="favori" className="absolute right-2 top-2 text-base text-gold drop-shadow">★</span>
            )}
          </div>
          <div className="flex flex-col gap-1 p-3">
            <span className="font-serif text-base font-medium text-ink">{etablissement.nom}</span>
            {etablissement.ville && <span className="text-xs text-muted">{etablissement.ville}</span>}
            <div className="mt-1 flex items-center justify-between gap-2">
              {note}
              {chips}
            </div>
          </div>
        </Link>
      </li>
    );
  }

  return (
    <li data-testid="place-card">
      <Link
        href={`/${base}/${etablissement.id}`}
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
          {(note || chips) && (
            <div className="mt-1 flex items-center gap-2">
              {note}
              {note && chips && <span className="text-line">·</span>}
              {chips}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
