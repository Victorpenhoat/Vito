import { z } from "zod";

// Inscription sur invitation (Onboarding lot O-C).
export const INVITATION_ROLES = ["membre", "invite", "cercle"] as const;

export const creerCompteSchema = z.object({
  token: z.string().min(24).max(128),
  email: z.string().email(),
  // Un mot de passe est demandé à la création : il sert de repli au
  // déverrouillage (décision PO) tant que les passkeys ne sont pas là.
  password: z.string().min(8).max(200),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  // Acceptation explicite, jamais pré-cochée (design écran 7).
  conditions: z.literal("on", { message: "Conditions non acceptées" }),
});

export const inviterSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  roleVise: z.enum(INVITATION_ROLES),
  voyageId: z.string().uuid().optional().or(z.literal("")),
});
