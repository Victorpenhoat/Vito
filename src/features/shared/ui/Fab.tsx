import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/routing";

const FAB_CLASS =
  "fixed bottom-20 right-6 z-20 grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-black/30 transition-colors hover:bg-accent-hover md:bottom-6";

export function Fab({
  icon, label, href, onClick,
}: { icon: ReactNode; label: string; href?: string; onClick?: () => void }) {
  if (href) {
    return (
      <Link href={href} aria-label={label} className={FAB_CLASS}>
        {icon}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={FAB_CLASS}>
      {icon}
    </button>
  );
}
