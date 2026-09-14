import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Local password hashing adapter (scrypt).
 * Maps cleanly to Supabase Auth password credentials later.
 * Staff profiles still use plaintext compare in seed — do not mix the two.
 */
export function hashPassword(password: string): string {
  if (password.length < 8) {
    throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  }
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !password) return false;
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "base64url");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
