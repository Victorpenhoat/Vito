import { Link } from "@/lib/i18n/routing";
import { statutTint } from "../domain/statutTint";
import { formatRange } from "@/lib/format/date";

type Voyage = { id: string; titre: string; destination: string | null; date_debut: string | null; date_fin: string | null; statut: string };

export function VoyageCard({ voyage, statutLabel, locale }: { voyage: Voyage; statutLabel: string; locale: string }) {
  const dates = formatRange(voyage.date_debut, voyage.date_fin, locale);
  const sub = [voyage.destination, dates].filter(Boolean).join(" · ");
  return (
    <li data-testid="voyage-card" className={voyage.statut === "termine" ? "opacity-70" : ""}>
      <Link href={`/voyages/${voyage.id}`} className="block overflow-hidden rounded-card border border-line bg-surface">
        <div className="relative h-28" style={{ background: statutTint(voyage.statut) }}>
          <span className="absolute left-3 top-3 rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">{statutLabel}</span>
        </div>
        <div className="flex flex-col gap-1 p-4">
          <span className="font-serif text-xl font-medium text-ink">{voyage.titre}</span>
          {sub && <span className="text-sm text-muted">{sub}</span>}
        </div>
      </Link>
    </li>
  );
}
