import { z } from "zod";

export const familleInputSchema = z.object({ nom: z.string().min(1).max(120) });
export type FamilleInput = z.infer<typeof familleInputSchema>;

export const inviteSchema = z.object({ email: z.string().email() });
export type InviteInput = z.infer<typeof inviteSchema>;
