/**
 * Business white-label branding — resolved from ACTIVE BUSINESS only.
 * Never hard-code POND globally. Never accept client businessId overrides.
 */

import type { Business } from "./types";
import { isWhiteLabelStorefront } from "./booking-entitlements";
import { kubhaiBrand, storePlaceholderBrand } from "@/lib/brand/tokens";

export type BusinessBranding = {
  businessId: string;
  businessName: string;
  shortName: string;
  slug: string;
  logoUrl: string | null;
  logoMarkUrl: string | null;
  faviconUrl: string | null;
  coverUrl: string | null;
  /** Optional customer-booking hero (desktop / tablet). Falls back to coverUrl. */
  bookingHeroImageUrl: string | null;
  /** Optional mobile booking hero. Falls back to bookingHeroImageUrl → coverUrl. */
  bookingMobileHeroImageUrl: string | null;
  /** Marketing line for booking hero. Falls back to customerSupportText / neutral copy. */
  bookingTagline: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  lineUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  address: string | null;
  customerSupportText: string | null;
  poweredByKubHaiEnabled: boolean;
  updatedAt: string;
};

const HEX = /^#([0-9a-fA-F]{6})$/;

export function sanitizeHexColor(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return HEX.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

function softFromPrimary(primary: string): string {
  // Lightweight tint fallback when secondary missing
  return `${primary}14`;
}

/**
 * Pilot defaults for known seed stores — only applied when DB fields are empty.
 * Other stores get neutral placeholders (never POND assets).
 */
export const POND_BRAND_DEFAULTS = {
  shortName: "POND",
  logoUrl: "/brand/pond-logo.jpg",
  primaryColor: "#0F3D3E",
  secondaryColor: "#E8F0EF",
  accentColor: "#C4A35A",
  textColor: "#0F1724",
  backgroundColor: "#F7F3EA",
  bookingTagline: "เดินทางเชียงใหม่อย่างสบายใจ",
} as const;

export const DEMO002_BRAND_DEFAULTS = {
  shortName: "Demo 002",
  logoUrl: null as string | null,
  primaryColor: "#1E3A5F",
  secondaryColor: "#E8EEF5",
  accentColor: "#D97706",
  textColor: "#0F1724",
  backgroundColor: "#F8FAFC",
  bookingTagline: null as string | null,
} as const;

export function resolveBusinessBranding(business: Business): BusinessBranding {
  const isPond = business.slug === "pondcarrent";
  const isDemo002 = business.slug === "demo-store-002";
  const defaults = isPond
    ? POND_BRAND_DEFAULTS
    : isDemo002
      ? DEMO002_BRAND_DEFAULTS
      : {
          shortName: business.name.split(/\s+/)[0] || business.name,
          logoUrl: null as string | null,
          primaryColor: storePlaceholderBrand.primary,
          secondaryColor: storePlaceholderBrand.primarySoft,
          accentColor: storePlaceholderBrand.accent,
          textColor: "#0F1724",
          backgroundColor: storePlaceholderBrand.paper,
        };

  const primaryColor = sanitizeHexColor(business.primaryColor, defaults.primaryColor);
  const accentColor = sanitizeHexColor(business.accentColor, defaults.accentColor);
  const secondaryColor = sanitizeHexColor(
    business.secondaryColor,
    defaults.secondaryColor || softFromPrimary(primaryColor),
  );
  const backgroundColor = sanitizeHexColor(business.backgroundColor, defaults.backgroundColor);
  const textColor = sanitizeHexColor(business.textColor, defaults.textColor);

  const logoUrl = business.logoUrl || defaults.logoUrl || null;
  const coverUrl = business.coverUrl;
  const bookingTaglineDefault =
    "bookingTagline" in defaults ? (defaults as { bookingTagline?: string | null }).bookingTagline : null;

  // Stored custom booking assets only — never alias coverUrl (often a vehicle photo).
  const bookingHeroImageUrl = business.bookingHeroImageUrl?.trim() || null;
  const bookingMobileHeroImageUrl = business.bookingMobileHeroImageUrl?.trim() || null;

  return {
    businessId: business.id,
    businessName: business.name,
    shortName: (business.shortName?.trim() || defaults.shortName || business.name).slice(0, 40),
    slug: business.slug,
    logoUrl,
    logoMarkUrl: business.logoMarkUrl ?? logoUrl,
    faviconUrl: business.faviconUrl ?? logoUrl,
    coverUrl,
    bookingHeroImageUrl,
    bookingMobileHeroImageUrl,
    bookingTagline:
      business.bookingTagline?.trim() ||
      bookingTaglineDefault ||
      business.customerSupportText?.trim() ||
      null,
    primaryColor,
    secondaryColor,
    accentColor,
    textColor,
    backgroundColor,
    phone: business.phone,
    email: business.email,
    website: business.websiteUrl,
    lineUrl: business.lineUrl,
    facebookUrl: business.facebookUrl,
    instagramUrl: business.instagramUrl,
    address: business.address,
    customerSupportText: business.customerSupportText,
    poweredByKubHaiEnabled: business.poweredByKubHaiEnabled !== false,
    updatedAt: business.updatedAt,
  };
}

/**
 * Branding for CUSTOMER-facing surfaces (/s/{slug}, /booking/{token}).
 *
 * White-label storefronts keep the partner brand and never show KubHai chrome.
 * Without the entitlement the storefront is hosted under KubHai/ขับให้ colours and
 * logo — the partner name/contact stays visible because it is who serves the trip.
 */
export function resolveCustomerStorefrontBranding(business: Business): BusinessBranding {
  const brand = resolveBusinessBranding(business);
  if (isWhiteLabelStorefront(business.subscriptionPlan)) {
    return { ...brand, poweredByKubHaiEnabled: false };
  }
  const c = kubhaiBrand.colors;
  return {
    ...brand,
    logoUrl: kubhaiBrand.logoSrc,
    logoMarkUrl: kubhaiBrand.logoSrc,
    faviconUrl: kubhaiBrand.logoSrc,
    bookingHeroImageUrl: null,
    bookingMobileHeroImageUrl: null,
    bookingTagline: null,
    primaryColor: c.navy800,
    secondaryColor: "#E6ECF5",
    accentColor: c.accent,
    textColor: c.ink,
    backgroundColor: "#F6F3EE",
    poweredByKubHaiEnabled: true,
  };
}

/** Inline CSS variables for store-scoped surfaces (customer + branded admin). */
export function brandingCssVars(brand: BusinessBranding): Record<string, string> {
  return {
    "--store-primary": brand.primaryColor,
    "--store-primary-soft": brand.secondaryColor,
    "--store-accent": brand.accentColor,
    "--store-paper": brand.backgroundColor,
    "--store-ink": brand.textColor,
  };
}

export type BrandPatch = Partial<
  Pick<
    Business,
    | "name"
    | "shortName"
    | "logoUrl"
    | "logoMarkUrl"
    | "faviconUrl"
    | "coverUrl"
    | "bookingHeroImageUrl"
    | "bookingMobileHeroImageUrl"
    | "bookingTagline"
    | "bookingLayoutPreset"
    | "bookingThemePreset"
    | "primaryColor"
    | "secondaryColor"
    | "accentColor"
    | "textColor"
    | "backgroundColor"
    | "phone"
    | "email"
    | "websiteUrl"
    | "lineUrl"
    | "facebookUrl"
    | "instagramUrl"
    | "address"
    | "customerSupportText"
    | "poweredByKubHaiEnabled"
  >
>;
