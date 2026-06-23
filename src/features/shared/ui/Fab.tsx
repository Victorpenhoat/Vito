import type { ReactNode } from "react";

export function Fab({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-6 right-6 grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-black/30 transition-colors hover:bg-accent-hover"
    >
      {icon}
    </button>
  );
}
