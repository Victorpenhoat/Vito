export function maskDocNumber(num: string | null): string {
  if (!num) return "";
  if (num.length <= 3) return "•".repeat(num.length);
  return "•".repeat(num.length - 3) + num.slice(-3);
}
