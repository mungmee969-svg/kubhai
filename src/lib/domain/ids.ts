import { randomBytes, randomUUID } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

export function newSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

export function newBookingCode(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `KH-${y}${m}${d}-${suffix}`;
}

export function newSessionId(): string {
  return randomBytes(16).toString("base64url");
}
