/**
 * Safe media / appearance field validation for partner booking customization.
 * No arbitrary CSS/HTML/JS — token/config URLs only.
 */

const SAFE_RELATIVE = /^\/[a-zA-Z0-9/_.,\-]+$/;
const SAFE_HTTPS = /^https:\/\/[a-zA-Z0-9._\-]+(?::\d+)?(?:\/[a-zA-Z0-9/_.,\-%]*)?$/;

export function sanitizeBookingMediaUrl(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 400) return null;
  // Block data URLs, javascript:, and protocol-relative tricks
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (trimmed.startsWith("//")) return null;
  if (SAFE_RELATIVE.test(trimmed) || SAFE_HTTPS.test(trimmed)) return trimmed;
  return null;
}

export function sanitizeBookingTagline(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.replace(/<[^>]*>/g, "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 160);
}

export function sanitizeLayoutPreset(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[a-z0-9][a-z0-9\-]{0,39}$/.test(trimmed)) return null;
  return trimmed;
}
