import { z } from "zod";

export const centsFromEuros = z
  .string()
  .regex(/^\d+([.,]\d{1,2})?$/, "Montant invalide")
  .transform((s) => Math.round(Number.parseFloat(s.replace(",", ".")) * 100))
  .refine((c) => c > 0, "Montant doit être > 0");

export function formatCents(cents: number, devise: string): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} ${devise}`;
}
