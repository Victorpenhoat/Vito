"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { signOut } from "@/features/auth/data/actions";

type Role = "client" | "agence" | "admin";

const CORE = ["restos", "voyages", "depenses", "famille", "conciergerie", "vins", "abonnement"] as const;

export function AppNav({ role }: { role: Role }) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const items: string[] = [...CORE];
  if (role === "agence" || role === "admin") items.push("agence");
  if (role === "admin") items.push("admin");
  const isActive = (key: string) => pathname.startsWith(`/${key}`);
  return (
    <header
      data-testid="app-nav"
      className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface px-4"
    >
      <Link href="/restos" className="text-lg font-extrabold tracking-tight">
        {tApp("name")}
        <span className="text-accent">.</span>
      </Link>
      <nav className="flex flex-1 gap-1 overflow-x-auto">
        {items.map((key) => (
          <Link
            key={key}
            href={`/${key}`}
            data-testid={`nav-${key}`}
            aria-current={isActive(key) ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              isActive(key) ? "bg-accent-50 text-accent-600" : "text-muted hover:bg-canvas"
            }`}
          >
            {t(key)}
          </Link>
        ))}
      </nav>
      <form action={signOut}>
        <button
          type="submit"
          className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-canvas"
        >
          {t("deconnexion")}
        </button>
      </form>
    </header>
  );
}
