import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** 256-bit random token, base64url (43 chars). Used for invitation links. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex. Sufficient for high-entropy tokens (not for passwords or short codes). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Uniformly random 6-digit code, zero-padded. */
export function generateVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Keyed hash of a short code. The secret prevents offline brute force of the
 * 10^6 code space if the database leaks; the context binds it to one invitation.
 */
export function hmacCode(secret: string, context: string, code: string): string {
  return createHmac("sha256", secret).update(`${context}:${code}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
