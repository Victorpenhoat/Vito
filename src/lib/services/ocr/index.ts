import { env } from "@/lib/env";
import { MockOcrProvider } from "./mock";
import { AnthropicOcrProvider } from "./anthropic";
import type { OcrProvider } from "./types";

export function getOcrProvider(): OcrProvider {
  if (env.ANTHROPIC_API_KEY) return new AnthropicOcrProvider(env.ANTHROPIC_API_KEY);
  return new MockOcrProvider();
}

export type { OcrProvider, OcrResult, OcrFields } from "./types";
export { EMPTY_FIELDS } from "./types";
