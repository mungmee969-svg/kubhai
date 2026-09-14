import { createHmac, timingSafeEqual } from "node:crypto";

export const CUSTOMER_SESSION_COOKIE = "kh_customer_session";
const TTL_MS = 60 * 60 * 24 * 14;

export type CustomerSessionPayload = {
  customerAccountId: string;
  phone: string | null;
  phoneVerified: boolean;
  displayName: string | null;
  exp: number;
};

function secret(): string {
  return (
    process.env.KUBHAI_CUSTOMER_SESSION_SECRET ||
    process.env.KUBHAI_SESSION_SECRET ||
    "local-dev-customer-session"
  );
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeCustomerSession(payload: CustomerSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeCustomerSession(token: string | undefined): CustomerSessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CustomerSessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export { TTL_MS as CUSTOMER_SESSION_TTL_MS };
