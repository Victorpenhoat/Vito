import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptDocument(plain: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error("clé invalide : 32 octets attendus");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decryptDocument(blob: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error("clé invalide : 32 octets attendus");
  if (blob.length < IV_LEN + TAG_LEN) throw new Error("blob invalide");
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]); // throw si tag invalide
}
