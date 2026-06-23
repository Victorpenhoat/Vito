export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export type Tone = "green" | "blue" | "amber" | "violet";

export function toneClasses(tone: Tone): { bg: string; text: string } {
  const map: Record<Tone, { bg: string; text: string }> = {
    green: { bg: "bg-kpi-green-bg", text: "text-kpi-green" },
    blue: { bg: "bg-kpi-blue-bg", text: "text-kpi-blue" },
    amber: { bg: "bg-kpi-amber-bg", text: "text-kpi-amber" },
    violet: { bg: "bg-kpi-violet-bg", text: "text-kpi-violet" },
  };
  return map[tone];
}
