import { env } from "@/lib/env";

export function getDocumentKey(): Buffer {
  const hex = env.DOCUMENTS_ENCRYPTION_KEY;
  if (!hex) throw new Error("DOCUMENTS_ENCRYPTION_KEY manquante");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("DOCUMENTS_ENCRYPTION_KEY doit faire 64 caractères hex (32 octets)");
  return key;
}
