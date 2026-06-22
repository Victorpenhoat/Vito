import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptDocument, decryptDocument } from "./documents";

const key = randomBytes(32);

describe("documents crypto (AES-256-GCM)", () => {
  it("round-trip : decrypt(encrypt(x)) === x", () => {
    const plain = Buffer.from("billet de train — réf ABC123 — ☕");
    const blob = encryptDocument(plain, key);
    expect(decryptDocument(blob, key).equals(plain)).toBe(true);
  });
  it("le ciphertext diffère du clair", () => {
    const plain = Buffer.from("secret");
    const blob = encryptDocument(plain, key);
    expect(blob.includes(plain)).toBe(false);
  });
  it("blob altéré -> throw (tag GCM)", () => {
    const blob = encryptDocument(Buffer.from("x".repeat(50)), key);
    blob[blob.length - 1] = (blob[blob.length - 1]! ^ 0xff); // flip le dernier octet du ciphertext
    expect(() => decryptDocument(blob, key)).toThrow();
  });
  it("clé de mauvaise longueur -> throw", () => {
    expect(() => encryptDocument(Buffer.from("x"), randomBytes(16))).toThrow();
  });
});
