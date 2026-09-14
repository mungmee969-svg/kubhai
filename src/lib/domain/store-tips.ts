import type { PlaceCategory, ServiceType } from "./enums";
import type { StoreTip } from "./types";

export const STORE_TIP_SURFACES = ["WIZARD", "DETAIL", "QUOTATION"] as const;
export type StoreTipSurface = (typeof STORE_TIP_SURFACES)[number];

export type StoreTipMatchContext = {
  serviceType?: ServiceType | null;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  passengerCount?: number | null;
  luggageCount?: number | null;
  multiDay?: boolean;
  placeIds?: string[];
  placeCategories?: PlaceCategory[];
  surface?: StoreTipSurface;
};

/** Rank and filter store-authored tips. Never invents content. */
export function matchStoreTips(
  tips: StoreTip[],
  context: StoreTipMatchContext,
  limit = 3,
): StoreTip[] {
  const surface = context.surface ?? "WIZARD";
  const scored = tips
    .filter((tip) => tip.active)
    .filter((tip) => !tip.surfaces.length || tip.surfaces.includes(surface))
    .map((tip) => ({ tip, score: scoreTip(tip, context) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || b.tip.priority - a.tip.priority || a.tip.title.localeCompare(b.tip.title));

  return scored.slice(0, Math.max(0, limit)).map((item) => item.tip);
}

function scoreTip(tip: StoreTip, context: StoreTipMatchContext): number {
  let score = tip.priority;

  if (tip.multiDayOnly) {
    if (!context.multiDay) return -1;
    score += 40;
  }

  if (tip.serviceType) {
    if (!context.serviceType || tip.serviceType !== context.serviceType) return -1;
    score += 50;
  }

  if (tip.minPassengers != null) {
    if ((context.passengerCount ?? 0) < tip.minPassengers) return -1;
    score += 15;
  }

  if (tip.minLuggage != null) {
    if ((context.luggageCount ?? 0) < tip.minLuggage) return -1;
    score += 15;
  }

  if (tip.placeId) {
    if (!context.placeIds?.includes(tip.placeId)) return -1;
    score += 45;
  }

  if (tip.category) {
    if (!context.placeCategories?.includes(tip.category)) {
      // soft miss unless category was the only location signal
      if (!tip.locationKeyword && !tip.placeId) return -1;
    } else {
      score += 25;
    }
  }

  if (tip.locationKeyword) {
    const hay = `${context.pickupLocation ?? ""} ${context.dropoffLocation ?? ""}`.toLowerCase();
    const needle = tip.locationKeyword.trim().toLowerCase();
    if (!needle || !hay.includes(needle)) return -1;
    score += 35;
  }

  // General tips (no targeting) still match with base priority
  return score;
}

export function isMultiDayService(serviceType: ServiceType | null | undefined, hasEndDate?: boolean) {
  if (serviceType === "MULTI_DAY_TRIP" || serviceType === "CUSTOM_TRIP") return true;
  return Boolean(hasEndDate);
}

export function customerVisibleNotes<T extends { audience?: "INTERNAL" | "CUSTOMER" }>(notes: T[]) {
  return notes.filter((item) => item.audience === "CUSTOMER");
}
