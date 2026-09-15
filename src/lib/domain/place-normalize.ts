import type { Place, PlaceKind, RecommendedPeriod } from "./types";
import { sanitizePlaceImages } from "./place-image";

const now = "2026-09-12T00:00:00.000Z";

const PLACE_KINDS = new Set<PlaceKind>(["PLACE", "GUIDE", "AREA", "COLLECTION", "INSPIRATION"]);

export function normalizePlace(raw: Partial<Place> & Pick<Place, "id" | "provinceId" | "category" | "name" | "slug">): Place {
  const cleaned = sanitizePlaceImages({
    coverImageUrl: raw.coverImageUrl ?? null,
    imageUrls: Array.isArray(raw.imageUrls) ? raw.imageUrls.filter(Boolean) : [],
  });
  const periods = Array.isArray(raw.recommendedPeriods)
    ? (raw.recommendedPeriods.filter((p) => p === "DAY" || p === "EVENING" || p === "NIGHT") as RecommendedPeriod[])
    : (["DAY"] as RecommendedPeriod[]);
  const placeKind: PlaceKind =
    raw.placeKind && PLACE_KINDS.has(raw.placeKind) ? raw.placeKind : "PLACE";
  const sponsored = Boolean(raw.sponsored);
  return {
    id: raw.id,
    businessId: raw.businessId ?? null,
    sourceType: raw.businessId ? "AGENT" : "PLATFORM",
    platformModerationStatus:
      raw.platformModerationStatus ??
      (raw.businessId ? "NOT_SUBMITTED" : "APPROVED"),
    platformSubmittedAt: raw.platformSubmittedAt ?? null,
    platformReviewedAt: raw.platformReviewedAt ?? null,
    platformReviewedByUserId: raw.platformReviewedByUserId ?? null,
    platformRejectionReason: raw.platformRejectionReason ?? null,
    provinceId: raw.provinceId,
    category: raw.category,
    subcategory: raw.subcategory ?? null,
    placeKind,
    name: raw.name,
    slug: raw.slug,
    description: raw.description ?? null,
    shortDescription: raw.shortDescription ?? null,
    imageUrls: cleaned.imageUrls,
    coverImageUrl: cleaned.coverImageUrl,
    address: raw.address ?? null,
    district: raw.district ?? null,
    area: raw.area ?? null,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    googlePlaceId: raw.googlePlaceId ?? null,
    openingHours: raw.openingHours ?? null,
    priceLevel: raw.priceLevel ?? null,
    estimatedDurationMinutes: raw.estimatedDurationMinutes ?? null,
    entranceFee: raw.entranceFee ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    recommendedPeriods: periods.length ? periods : ["DAY"],
    localRecommended: Boolean(raw.localRecommended),
    featured: Boolean(raw.featured),
    sponsored,
    sponsorBusinessName: raw.sponsorBusinessName ?? null,
    sponsorLabel: sponsored ? raw.sponsorLabel ?? "สนับสนุน" : null,
    status: raw.status === "HIDDEN" ? "HIDDEN" : "ACTIVE",
    sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : 100,
    isSeed: Boolean(raw.isSeed),
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}

export function isPlatformDiscoveryEligible(
  place: Pick<Place, "status" | "sourceType" | "platformModerationStatus">,
): boolean {
  return (
    place.status === "ACTIVE" &&
    (place.sourceType === "PLATFORM" ||
      place.platformModerationStatus === "APPROVED")
  );
}

export function isStorefrontPublishedPlace(
  place: Pick<Place, "businessId" | "status">,
  businessId: string,
): boolean {
  return place.businessId === businessId && place.status === "ACTIVE";
}
