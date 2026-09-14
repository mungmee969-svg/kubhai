/**
 * Compose booking presentation: location theme + partner brand + plan entitlements.
 * Does not fork booking business logic.
 */

import type { Business, Province, Region } from "./types";
import {
  resolveBusinessBranding,
  type BusinessBranding,
  sanitizeHexColor,
} from "./branding";
import {
  hasBookingCapability,
  listBookingCapabilities,
  normalizeSubscriptionPlan,
  type BookingCapability,
  type SubscriptionPlanId,
} from "./booking-entitlements";
import {
  resolveBookingLocationTheme,
  type BookingLocationTheme,
} from "./booking-location-theme";

export type BookingHeroSource =
  | "custom"
  | "location"
  | "regional"
  | "generic";

export type BookingHeroPresentation = {
  desktopUrl: string;
  mobileUrl: string;
  objectPositionDesktop: string;
  objectPositionMobile: string;
  source: BookingHeroSource;
  locationThemeId: string;
};

export type BookingPresentation = {
  brand: BusinessBranding;
  locationTheme: BookingLocationTheme;
  hero: BookingHeroPresentation;
  /** Tagline shown on booking hero (entitled custom or brand default). */
  displayTagline: string | null;
  placeLabel: string;
  planId: SubscriptionPlanId;
  capabilities: BookingCapability[];
  /** True when custom hero exists in storage but plan no longer allows it. */
  customHeroRetainedButInactive: boolean;
  layoutPreset: string;
};

function relativeLuminance(hex: string): number {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return 0;
  const channel = (i: number) => {
    const c = parseInt(raw.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Ensure CTA / hero text stay readable against partner primary. */
export function accessibleOnPrimary(primary: string): {
  ink: string;
  muted: string;
} {
  const lum = relativeLuminance(sanitizeHexColor(primary, "#0F3D3E"));
  if (lum > 0.55) {
    return { ink: "#0F1724", muted: "rgba(15,23,36,0.72)" };
  }
  return { ink: "#FFFFFF", muted: "rgba(255,255,255,0.78)" };
}

function isUsableImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const t = url.trim();
  if (!t) return false;
  // Reject obvious vehicle/fleet paths as location fallbacks (cover misuse)
  if (/^\/fleet\//i.test(t)) return false;
  if (t.startsWith("/") || t.startsWith("https://") || t.startsWith("http://")) return true;
  return false;
}

function heroSourceForTheme(theme: BookingLocationTheme): BookingHeroSource {
  if (theme.themeId.startsWith("location.chiang-mai")) return "location";
  if (theme.themeId.includes("northern")) return "regional";
  if (theme.themeId.includes("kubhai")) return "generic";
  return "location";
}

export function resolveBookingPresentation(input: {
  business: Business;
  province?: Province | null;
  region?: Region | null;
}): BookingPresentation {
  const { business, province = null, region = null } = input;
  const brand = resolveBusinessBranding(business);
  const locationTheme = resolveBookingLocationTheme({
    provinceId: province?.id ?? business.provinceId,
    provinceSlug: province?.slug ?? null,
    provinceNameTh: province?.nameTh ?? null,
    regionId: region?.id ?? business.regionId,
    regionNameTh: region?.nameTh ?? null,
  });

  const planId = normalizeSubscriptionPlan(business.subscriptionPlan);
  const capabilities = listBookingCapabilities(business.subscriptionPlan);
  const canCustomHero = hasBookingCapability(business.subscriptionPlan, "booking.customHero");
  const canCustomTheme = hasBookingCapability(business.subscriptionPlan, "booking.customTheme");
  const canCustomLayout = hasBookingCapability(business.subscriptionPlan, "booking.customLayout");

  const storedDesktop = business.bookingHeroImageUrl?.trim() || null;
  const storedMobile = business.bookingMobileHeroImageUrl?.trim() || null;
  const hasStoredCustom =
    isUsableImageUrl(storedDesktop) || isUsableImageUrl(storedMobile);

  let hero: BookingHeroPresentation;
  if (canCustomHero && isUsableImageUrl(storedDesktop)) {
    hero = {
      desktopUrl: storedDesktop,
      mobileUrl: isUsableImageUrl(storedMobile) ? storedMobile : storedDesktop,
      objectPositionDesktop: "50% 40%",
      objectPositionMobile: "50% 35%",
      source: "custom",
      locationThemeId: locationTheme.themeId,
    };
  } else {
    const mobile =
      locationTheme.mobileHeroImage || locationTheme.desktopHeroImage;
    hero = {
      desktopUrl: locationTheme.desktopHeroImage,
      mobileUrl: mobile,
      objectPositionDesktop: locationTheme.objectPositionDesktop,
      objectPositionMobile: locationTheme.objectPositionMobile,
      source: heroSourceForTheme(locationTheme),
      locationThemeId: locationTheme.themeId,
    };
  }

  const storedTagline = business.bookingTagline?.trim() || null;
  let displayTagline: string | null;
  if (canCustomTheme) {
    displayTagline = storedTagline || brand.bookingTagline;
  } else if (storedTagline) {
    // Retained custom tagline must not render without entitlement
    displayTagline =
      business.customerSupportText?.trim() ||
      (business.slug === "pondcarrent" ? "เดินทางเชียงใหม่อย่างสบายใจ" : null) ||
      null;
  } else {
    displayTagline = brand.bookingTagline;
  }

  const placeLabel =
    locationTheme.labelTh ||
    province?.nameTh ||
    region?.nameTh ||
    "ท่องเที่ยว";

  const layoutPreset =
    canCustomLayout && business.bookingLayoutPreset?.trim()
      ? business.bookingLayoutPreset.trim()
      : "standard-6-card";

  return {
    brand,
    locationTheme,
    hero,
    displayTagline,
    placeLabel,
    planId,
    capabilities,
    customHeroRetainedButInactive: Boolean(hasStoredCustom && !canCustomHero),
    layoutPreset,
  };
}
