import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "@/lib/domain/enums";
import type { Actor } from "@/lib/domain/types";

const COOKIE = "kh_session";

export type SessionPayload = {
  userId: string;
  email: string;
  role: Role;
  businessIds: string[];
  exp: number;
};

function secret(): string {
  return process.env.KUBHAI_SESSION_SECRET || "local-dev-only-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE)?.value);
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function actorFromSession(session: SessionPayload | null): Actor {
  if (!session) return { kind: "public", sessionId: "anonymous" };
  return {
    kind: "user",
    userId: session.userId,
    role: session.role,
    businessIds: session.businessIds,
  };
}

export function defaultBusinessId(session: SessionPayload): string | null {
  return session.businessIds[0] ?? null;
}

export { COOKIE as SESSION_COOKIE };
