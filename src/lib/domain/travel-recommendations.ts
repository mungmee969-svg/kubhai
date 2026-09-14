/**
 * Travel recommendations — same Place source as Store Admin «ทริป / สถานที่».
 * Customer chips use PLACE_CATEGORY_LABELS (admin taxonomy). Do not invent a second CMS.
 */

import { PLACE_CATEGORY_LABELS, type PlaceCategory } from "./enums";
import type { Place } from "./types";
import { resolvePlaceImageUrl } from "./place-image";

/** Matches Store Admin PRIMARY chips on /store/places. */
export const TRAVEL_RECOMMENDATION_CHIPS = [
  "ATTRACTION",
  "RESTAURANT",
  "LOCAL_FOOD",
  "CAFE",
  "HOTEL",
  "ACTIVITY",
  "SOUVENIR",
] as const;

export type TravelRecommendationChip = (typeof TRAVEL_RECOMMENDATION_CHIPS)[number];

export function travelRecommendationLabel(category: PlaceCategory | "ALL"): string {
  if (category === "ALL") return "ทั้งหมด";
  return PLACE_CATEGORY_LABELS[category];
}

/** Customer-visible only — reuse ACTIVE status (no second visibility flag). */
export function isCustomerVisiblePlace(place: Place): boolean {
  return place.status === "ACTIVE" && !place.name.includes("ตัวอย่าง");
}

/**
 * Filter places for เที่ยวแนะนำ.
 * Expects the same authoritative Place rows as getPublicStore / admin catalog
 * (platform null + store-owned for province, already ACTIVE on public storefront).
 */
export function filterTravelRecommendations(
  places: Place[],
  opts: {
    category?: TravelRecommendationChip | "ALL" | null;
    provinceId?: string | null;
    limit?: number;
  } = {},
): Place[] {
  const category = opts.category ?? "ALL";
  let rows = places.filter(isCustomerVisiblePlace);
  if (opts.provinceId) {
    rows = rows.filter((item) => item.provinceId === opts.provinceId);
  }
  if (category !== "ALL") {
    rows = rows.filter((item) => item.category === category);
  }
  rows = [...rows].sort((a, b) => {
    if (a.localRecommended !== b.localRecommended) return a.localRecommended ? -1 : 1;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "th");
  });
  if (opts.limit != null) rows = rows.slice(0, Math.max(0, opts.limit));
  return rows;
}

export function travelPlaceCoverUrl(place: Place): string {
  return resolvePlaceImageUrl(place);
}

export function travelPlaceShortText(place: Place): string {
  return (place.shortDescription ?? place.description ?? "").trim();
}
