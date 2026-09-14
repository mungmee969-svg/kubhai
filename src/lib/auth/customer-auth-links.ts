/**
 * Client-safe customer auth URL helpers.
 * Keep this module free of @/lib/data / node:fs so client components can import it.
 */

const PLATFORM_FORBIDDEN_PREFIXES = ["/store", "/admin", "/invite"];

/** Sanitize customer return paths. Reject open redirects and staff surfaces. */
export function sanitizeCustomerReturnTo(raw: string | null | undefined, fallback: string): string {
  if (!raw || typeof raw !== "string") return fallback;
  let path = raw.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return fallback;
  const pathOnly = path.split("?")[0]?.split("#")[0] ?? path;
  for (const prefix of PLATFORM_FORBIDDEN_PREFIXES) {
    if (pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)) return fallback;
  }
  return path;
}

/** Build login URL for platform entry (KubHai root /account). */
export function platformLoginHref(next?: string | null): string {
  const params = new URLSearchParams();
  params.set("context", "platform");
  if (next) params.set("next", next);
  return `/account/login?${params.toString()}`;
}

/** Build login URL for partner storefront / booking entry. */
export function partnerLoginHref(storeSlug: string, next?: string | null): string {
  const params = new URLSearchParams();
  params.set("store", storeSlug);
  params.set("next", next || `/s/${storeSlug}`);
  return `/account/login?${params.toString()}`;
}

/** Query param that carries a booking claim through login / phone verification. */
export const BOOKING_CLAIM_PARAM = "claim";

/** Partner «my bookings» URL that links the token-held booking on arrival. */
export function partnerBookingsClaimPath(storeSlug: string, token: string): string {
  return withClaim(`/s/${storeSlug}/bookings`, token);
}

/** Booking detail URL that retries the claim on arrival (after login / phone verify). */
export function bookingDetailClaimPath(token: string): string {
  return `/booking/${token}?${BOOKING_CLAIM_PARAM}=1`;
}

/**
 * Login URL that carries the booking claim token to `bookingsPath`.
 * Guest bookings are only discoverable by token, so the token must survive login.
 */
export function partnerLoginHrefWithClaim(
  storeSlug: string,
  bookingsPath: string,
  token: string,
): string {
  return partnerLoginHref(storeSlug, withClaim(bookingsPath, token));
}

function withClaim(path: string, token: string): string {
  const trimmed = token?.trim();
  if (!trimmed) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${BOOKING_CLAIM_PARAM}=${encodeURIComponent(trimmed)}`;
}
