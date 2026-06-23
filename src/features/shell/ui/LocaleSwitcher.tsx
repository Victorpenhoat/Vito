"use client";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import { useLocale } from "next-intl";
import { routing } from "@/lib/i18n/routing";

export function LocaleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const current = useLocale();
  return (
    <div data-testid="locale-switcher" className="flex gap-1 text-xs">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          aria-current={loc === current ? "true" : undefined}
          className={`rounded px-1.5 py-1 uppercase ${loc === current ? "text-ink font-semibold" : "text-faint hover:text-muted"}`}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
