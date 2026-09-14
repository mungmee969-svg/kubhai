import { cookies } from "next/headers";
import type { Actor } from "@/lib/domain/types";
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_TTL_MS,
  decodeCustomerSession,
  encodeCustomerSession,
  type CustomerSessionPayload,
} from "./customer-session-token";

export type { CustomerSessionPayload };
export { CUSTOMER_SESSION_COOKIE, decodeCustomerSession, encodeCustomerSession };

export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const jar = await cookies();
  return decodeCustomerSession(jar.get(CUSTOMER_SESSION_COOKIE)?.value);
}

export async function setCustomerSession(
  payload: Omit<CustomerSessionPayload, "exp"> & { exp?: number },
): Promise<void> {
  const jar = await cookies();
  const full: CustomerSessionPayload = {
    ...payload,
    exp: payload.exp ?? Date.now() + CUSTOMER_SESSION_TTL_MS,
  };
  jar.set(CUSTOMER_SESSION_COOKIE, encodeCustomerSession(full), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(CUSTOMER_SESSION_TTL_MS / 1000),
  });
}

export async function clearCustomerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(CUSTOMER_SESSION_COOKIE);
}

export function actorFromCustomerSession(session: CustomerSessionPayload | null): Actor {
  if (!session) return { kind: "public", sessionId: "anonymous" };
  return { kind: "customer", customerAccountId: session.customerAccountId };
}
