import { getStore } from "@/lib/data";
import { allowsTripPackages } from "@/lib/domain/booking-entitlements";
import type { TripPackage } from "@/lib/domain/trip-package";
import type { Business } from "@/lib/domain/types";

/**
 * Customer-visible package catalog for one storefront.
 * Published only (tenant-isolated in the store) and empty for plans without
 * the storefront.tripPackages capability.
 */
export async function publicTripPackagesFor(business: Business): Promise<TripPackage[]> {
  if (!allowsTripPackages(business.subscriptionPlan)) return [];
  return getStore().listPublicTripPackages(business.id);
}
