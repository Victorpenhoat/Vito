export function greeting(hour: number): "bonjour" | "bonsoir" {
  return hour >= 18 || hour < 5 ? "bonsoir" : "bonjour";
}
