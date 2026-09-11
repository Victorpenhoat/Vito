import { toneClasses, type Tone } from "./helpers";

export function Tile({ tone, label, value }: { tone: Tone; label: string; value: string | number }) {
  return (
    // Le nombre est en serif : c'est la respiration que le canevas donne aux
    // chiffres, et ce qui distingue une statistique d'un compteur. La couleur
    // du ton passe au fond et à la bordure, le chiffre reste en --ink.
    <div className={`rounded-tile border p-3.5 ${toneClasses(tone)}`}>
      <div className="font-serif text-2xl leading-none text-ink">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{label}</div>
    </div>
  );
}
