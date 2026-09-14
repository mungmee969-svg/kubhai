/**
 * Place / discovery imagery — MUST stay separate from fleet vehicle photos.
 * Never fall back to /fleet/* for places.
 */

import type { PlaceCategory } from "./enums";
import type { Place, PlaceKind } from "./types";

const FLEET_PATH_RE = /^\/fleet\//i;

export const PLACE_CATEGORY_PLACEHOLDERS: Record<string, string> = {
  ATTRACTION: "/discovery/placeholders/attraction.svg",
  RESTAURANT: "/discovery/placeholders/restaurant.svg",
  LOCAL_FOOD: "/discovery/placeholders/restaurant.svg",
  CAFE: "/discovery/placeholders/cafe.svg",
  HOTEL: "/discovery/placeholders/hotel.svg",
  RELAXATION: "/discovery/placeholders/relaxation.svg",
  SPA: "/discovery/placeholders/relaxation.svg",
  ACTIVITY: "/discovery/placeholders/activity.svg",
  SHOPPING: "/discovery/placeholders/shopping.svg",
  SOUVENIR: "/discovery/placeholders/souvenir.svg",
  OTHER: "/discovery/placeholders/other.svg",
};

export const DISCOVERY_HERO_IMAGE = "/discovery/placeholders/hero-north.svg";

export function isFleetImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (FLEET_PATH_RE.test(trimmed)) return true;
  try {
    const path = trimmed.startsWith("http") ? new URL(trimmed).pathname : trimmed;
    return FLEET_PATH_RE.test(path);
  } catch {
    return false;
  }
}

/** True when URL is usable for discovery Place imagery (not fleet). */
export function isValidPlaceImageUrl(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return false;
  if (isFleetImageUrl(url)) return false;
  return true;
}

export function categoryPlaceholderUrl(category: PlaceCategory | string | null | undefined): string {
  if (!category) return PLACE_CATEGORY_PLACEHOLDERS.OTHER;
  return PLACE_CATEGORY_PLACEHOLDERS[category] ?? PLACE_CATEGORY_PLACEHOLDERS.OTHER;
}

/**
 * Resolve display image for a Place.
 * Priority: valid cover → first valid gallery → category placeholder.
 * Never returns a fleet vehicle URL.
 */
export function resolvePlaceImageUrl(place: Pick<Place, "coverImageUrl" | "imageUrls" | "category">): string {
  if (isValidPlaceImageUrl(place.coverImageUrl)) return place.coverImageUrl!.trim();
  for (const src of place.imageUrls ?? []) {
    if (isValidPlaceImageUrl(src)) return src.trim();
  }
  return categoryPlaceholderUrl(place.category);
}

/** Strip fleet URLs from place image fields (seed migration / normalize). */
export function sanitizePlaceImages<T extends { coverImageUrl?: string | null; imageUrls?: string[] }>(raw: T): T {
  const imageUrls = (raw.imageUrls ?? []).filter((src) => isValidPlaceImageUrl(src));
  let coverImageUrl = raw.coverImageUrl ?? null;
  if (!isValidPlaceImageUrl(coverImageUrl)) coverImageUrl = null;
  return { ...raw, coverImageUrl, imageUrls };
}

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  PLACE: "สถานที่",
  GUIDE: "คู่มือ",
  AREA: "ย่าน",
  COLLECTION: "คอลเลกชัน",
  INSPIRATION: "แรงบันดาลใจ",
};

export function isSpecificBusinessPlace(place: Pick<Place, "placeKind">): boolean {
  return (place.placeKind ?? "PLACE") === "PLACE";
}
