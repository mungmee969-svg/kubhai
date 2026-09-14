import type { StructuredLocation } from "@/lib/domain/location";

/** Detect address strings that are primarily raw coordinates (never show as primary UI). */
export function isCoordinateLikeText(value: string | null | undefined): boolean {
  if (!value) return false;
  const t = value.trim();
  if (/^พิกัด\s*-?\d/.test(t)) return true;
  if (/^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(t)) return true;
  return false;
}

/** Customer-facing place title — never raw lat/lng. */
export function customerLocationTitle(loc: StructuredLocation | null | undefined): string {
  if (!loc) return "";
  const label = loc.label?.trim() || "";
  if (label && !isCoordinateLikeText(label)) return label;
  if (loc.address && !isCoordinateLikeText(loc.address)) return loc.address;
  return "ตำแหน่งที่เลือก";
}

/** Customer-facing address line — omit coordinate-like strings. */
export function customerLocationAddress(loc: StructuredLocation | null | undefined): string | null {
  if (!loc?.address?.trim()) return null;
  if (isCoordinateLikeText(loc.address)) return null;
  const title = customerLocationTitle(loc);
  if (loc.address.trim() === title) return null;
  return loc.address.trim();
}
