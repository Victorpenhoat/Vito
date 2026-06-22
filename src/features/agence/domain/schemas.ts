import { z } from "zod";

export const lierClientSchema = z.object({ email: z.string().email() });
export type LierClientInput = z.infer<typeof lierClientSchema>;
