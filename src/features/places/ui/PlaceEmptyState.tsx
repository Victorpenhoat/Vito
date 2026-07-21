"use client";
import { useTranslations } from "next-intl";

const ICON = {
  hotel: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-4 7 4v13" />
      <path d="M9 21v-5h6v5" />
      <path d="M9 11h.01M15 11h.01" />
    </>
  ),
  resto: (
    <>
      <path d="M4 3v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3M6 3v18" />
      <path d="M16 3c-1.5 0-3 1.5-3 5s1.5 4 3 4v6" />
    </>
  ),
};

export function PlaceEmptyState({
  category,
  kind,
  onDiscover,
}: {
  category: "resto" | "hotel";
  kind: "favoris" | "recommandes";
  onDiscover: () => void;
}) {
  const t = useTranslations("places");
  const title = kind === "favoris" ? t("emptyFavorisTitle") : t("emptyRecommandesTitle");
  const body = kind === "favoris" ? t("emptyFavorisBody") : t("emptyRecommandesBody");
  const cta = category === "hotel" ? t("emptyCtaHotel") : t("emptyCtaResto");

  return (
    <div
      data-testid="place-empty-state"
      className="flex flex-col items-center justify-center px-10 py-12 text-center"
    >
      <span className="mb-5 grid h-[92px] w-[92px] place-items-center rounded-full border border-line bg-sidebar text-faint">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICON[category]}
        </svg>
      </span>
      <h2 className="font-serif text-2xl font-medium text-ink">{title}</h2>
      <p className="mt-2.5 mb-6 max-w-xs text-sm leading-relaxed text-muted">{body}</p>
      <button
        type="button"
        onClick={onDiscover}
        className="rounded-control bg-accent px-5 py-3 text-sm font-semibold text-white"
      >
        {cta}
      </button>
    </div>
  );
}
