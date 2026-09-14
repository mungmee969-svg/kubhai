/**
 * Platform local-discovery helpers.
 * recommendedPeriods = editorial "when to visit" — NOT opening hours.
 */

import type { PlaceCategory } from "./enums";
import type { Place, RecommendedPeriod } from "./types";
import { resolvePlaceImageUrl } from "./place-image";

export const RECOMMENDED_PERIODS = ["DAY", "EVENING", "NIGHT"] as const;

export const RECOMMENDED_PERIOD_LABELS: Record<RecommendedPeriod, string> = {
  DAY: "เที่ยวกลางวัน",
  EVENING: "ช่วงเย็น",
  NIGHT: "เที่ยวกลางคืน",
};

/** Customer-facing discovery chips (subset of PlaceCategory). */
export const DISCOVERY_CATEGORIES = [
  "ATTRACTION",
  "RESTAURANT",
  "CAFE",
  "HOTEL",
  "RELAXATION",
  "ACTIVITY",
  "SHOPPING",
  "SOUVENIR",
] as const;

export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export const DISCOVERY_CATEGORY_LABELS: Record<DiscoveryCategory | "ALL", string> = {
  ALL: "ทั้งหมด",
  ATTRACTION: "ที่เที่ยว",
  RESTAURANT: "ร้านอาหาร",
  CAFE: "คาเฟ่",
  HOTEL: "ที่พัก",
  RELAXATION: "พักผ่อน",
  ACTIVITY: "กิจกรรม",
  SHOPPING: "ช้อปปิ้ง",
  SOUVENIR: "ของฝาก",
};

/** Map LOCAL_FOOD → restaurant; SPA → relaxation for discovery rails. */
export function discoveryCategoryOf(place: Place): DiscoveryCategory | null {
  if (place.category === "LOCAL_FOOD") return "RESTAURANT";
  if (place.category === "SPA") return "RELAXATION";
  if ((DISCOVERY_CATEGORIES as readonly string[]).includes(place.category)) {
    return place.category as DiscoveryCategory;
  }
  return null;
}

/**
 * Display image for place cards/detail.
 * Never returns fleet vehicle imagery.
 */
export function placeCoverUrl(place: Place): string {
  return resolvePlaceImageUrl(place);
}

export function placeShortText(place: Place): string {
  return (place.shortDescription ?? place.description ?? "").trim();
}

export function isPublicDiscoveryPlace(place: Place): boolean {
  return place.status === "ACTIVE" && !place.name.includes("ตัวอย่าง");
}

export function filterDiscoveryPlaces(
  places: Place[],
  opts: {
    category?: DiscoveryCategory | "ALL" | null;
    period?: RecommendedPeriod | "ALL" | null;
    provinceId?: string | null;
    featuredOnly?: boolean;
    limit?: number;
  } = {},
): Place[] {
  const category = opts.category ?? "ALL";
  const period = opts.period ?? "ALL";
  let rows = places.filter(isPublicDiscoveryPlace);
  if (opts.provinceId) {
    rows = rows.filter((item) => item.provinceId === opts.provinceId);
  }
  if (opts.featuredOnly) {
    rows = rows.filter((item) => item.featured || item.localRecommended);
  }
  if (category !== "ALL") {
    rows = rows.filter((item) => discoveryCategoryOf(item) === category);
  }
  if (period !== "ALL") {
    rows = rows.filter((item) => {
      const periods = item.recommendedPeriods?.length ? item.recommendedPeriods : (["DAY"] as RecommendedPeriod[]);
      return periods.includes(period);
    });
  }
  rows = [...rows].sort((a, b) => {
    if (a.sponsored !== b.sponsored) return a.sponsored ? 1 : -1;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "th");
  });
  if (opts.limit != null) rows = rows.slice(0, Math.max(0, opts.limit));
  return rows;
}

export function groupDiscoveryRails(places: Place[], provinceId?: string | null) {
  const base = places.filter(
    (item) => isPublicDiscoveryPlace(item) && (!provinceId || item.provinceId === provinceId),
  );
  return {
    day: filterDiscoveryPlaces(base, { period: "DAY", limit: 8 }),
    evening: filterDiscoveryPlaces(base, { period: "EVENING", limit: 6 }),
    night: filterDiscoveryPlaces(base, { period: "NIGHT", limit: 6 }),
    restaurants: filterDiscoveryPlaces(base, { category: "RESTAURANT", limit: 6 }),
    cafes: filterDiscoveryPlaces(base, { category: "CAFE", limit: 6 }),
    hotels: filterDiscoveryPlaces(base, { category: "HOTEL", limit: 4 }),
    relaxation: filterDiscoveryPlaces(base, { category: "RELAXATION", limit: 4 }),
    activities: filterDiscoveryPlaces(base, { category: "ACTIVITY", limit: 4 }),
    souvenirs: filterDiscoveryPlaces(base, { category: "SOUVENIR", limit: 4 }),
    shopping: filterDiscoveryPlaces(base, { category: "SHOPPING", limit: 4 }),
    attractions: filterDiscoveryPlaces(base, { category: "ATTRACTION", limit: 8 }),
  };
}

export function categoryMatchesChip(placeCategory: PlaceCategory, chip: DiscoveryCategory | "ALL") {
  if (chip === "ALL") return true;
  if (chip === "RESTAURANT") return placeCategory === "RESTAURANT" || placeCategory === "LOCAL_FOOD";
  if (chip === "RELAXATION") return placeCategory === "RELAXATION" || placeCategory === "SPA";
  return placeCategory === chip;
}

/** Lightweight search foundation tokens for future review-intent queries. */
export function discoverySearchTokens(place: Place): string[] {
  const chip = discoveryCategoryOf(place);
  const tokens = [
    place.name,
    place.area ?? "",
    place.district ?? "",
    place.shortDescription ?? "",
    ...(place.tags ?? []),
    chip ? DISCOVERY_CATEGORY_LABELS[chip] : "",
    ...place.recommendedPeriods.map((p) => RECOMMENDED_PERIOD_LABELS[p]),
    place.placeKind === "AREA" ? "ย่าน" : "",
    place.placeKind === "GUIDE" ? "คู่มือ" : "",
    "รีวิว",
    "เชียงใหม่",
  ];
  return tokens.map((t) => t.trim().toLowerCase()).filter(Boolean);
}
