import { z } from "zod";

export const SUBSCRIPTION_PERIODS = ["monthly", "yearly"] as const;
export const subscribeSchema = z.object({ period: z.enum(SUBSCRIPTION_PERIODS) });
export type SubscribeInput = z.infer<typeof subscribeSchema>;
