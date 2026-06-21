// Classification sans coût LLM (fallback). Le LLM affinera plus tard (services/llm).
export function classifyFallback(types: string[], priceLevel: number | null): string {
  const t = types.map((x) => x.toLowerCase());
  if ((priceLevel ?? 0) >= 4 || t.some((x) => x.includes("fine_dining"))) return "étoilé";
  if (t.some((x) => x.includes("bistro"))) return "bistrot";
  if (t.some((x) => x.includes("brasserie"))) return "brasserie";
  if (t.some((x) => x.includes("cafe"))) return "café";
  return "restaurant";
}
