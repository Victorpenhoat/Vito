import { toneClasses, type Tone } from "./helpers";

export function Tile({ tone, label, value }: { tone: Tone; label: string; value: string | number }) {
  const c = toneClasses(tone);
  return (
    <div className={`rounded-tile p-4 ${c.bg}`}>
      <div className={`text-2xl font-bold ${c.text}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
