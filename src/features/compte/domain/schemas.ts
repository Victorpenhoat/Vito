import { z } from "zod";

// Réglages > Profil (design Onboarding, écran 5) : prénom + nom.
// `display_name` en est dérivé — il reste la valeur affichée par le shell.
export const profilSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
});

/** Nom affiché dérivé du prénom et du nom (jamais saisi directement). */
export function displayNameDepuis(firstName: string, lastName?: string | null): string {
  return [firstName.trim(), (lastName ?? "").trim()].filter(Boolean).join(" ");
}
