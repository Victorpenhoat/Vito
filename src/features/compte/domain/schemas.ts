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

// Verrouillage de l'application (design Onboarding écran 6).
export const DELAIS_VERROU = [0, 1, 5, 15] as const;

export const preferencesVerrouSchema = z.object({
  delaiMinutes: z.coerce.number().refine((n) => (DELAIS_VERROU as readonly number[]).includes(n), {
    message: "Délai non proposé",
  }),
});

/** Le carnet doit-il être masqué ? `delaiMinutes = 0` verrouille dès qu'on quitte l'app. */
export function doitVerrouiller(delaiMinutes: number, msDepuisActivite: number): boolean {
  if (delaiMinutes === 0) return true;
  return msDepuisActivite >= delaiMinutes * 60_000;
}
