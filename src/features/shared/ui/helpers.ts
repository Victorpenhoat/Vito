export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export type Tone = "green" | "blue" | "amber" | "violet";

/**
 * Les classes de fond et de bordure d'une tuile, par ton.
 *
 * Le canevas veut un fond à 10 % et une bordure à 24 % ; aucun jeton ne porte
 * la bordure. Le modificateur d'opacité de Tailwind s'applique au jeton de ton,
 * ce qui évite d'ajouter quatre rôles — et d'écrire un littéral, que le
 * garde-fou des teintes refuserait.
 */
export function toneClasses(tone: Tone): string {
  const map: Record<Tone, string> = {
    green: "bg-kpi-green/10 border-kpi-green/24",
    blue: "bg-kpi-blue/10 border-kpi-blue/24",
    amber: "bg-kpi-amber/10 border-kpi-amber/24",
    violet: "bg-kpi-violet/10 border-kpi-violet/24",
  };
  return map[tone];
}
