import { z } from "zod";

const SUBSCRIPTION_PERIODS = ["monthly", "yearly"] as const;
export const subscribeSchema = z.object({ period: z.enum(SUBSCRIPTION_PERIODS) });
