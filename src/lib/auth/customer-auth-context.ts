/**
 * Customer auth PRESENTATION context.
 *
 * Identity remains ONE central CustomerAccount.
 * Presentation is PLATFORM (KubHai) or PARTNER (storefront brand).
 *
 * Never resolve platform auth branding from:
 * - last-store cookie
 * - default/seed POND business
 * - first business in DB
 */

import type { CSSProperties } from "react";
import { kubhaiBrand } from "@/lib/brand/tokens";
import {
  brandingCssVars,
  resolveCustomerStorefrontBranding,
  type BusinessBranding,
} from "@/lib/domain/branding";
import { getStore } from "@/lib/data";
import { sanitizeCustomerReturnTo } from "@/lib/auth/customer-auth-links";

export type CustomerAuthContextKind = "PLATFORM" | "PARTNER";

export type CustomerAuthPresentation = {
  kind: CustomerAuthContextKind;
  /** Display name in headers */
  displayName: string;
  shortName: string;
  logoUrl: string | null;
  loginSubtitle: string;
  signupSubtitle: string;
  heroTitle: string;
  heroBody: string;
  backHref: string;
  backLabel: string;
  /** Safe post-auth destination */
  returnTo: string;
  /** Partner branding when kind=PARTNER; null for platform */
  partnerBrand: BusinessBranding | null;
  /** CSS variables for the auth surface */
  cssVars: CSSProperties;
  poweredByKubHaiEnabled: boolean;
};

export {
  sanitizeCustomerReturnTo,
  platformLoginHref,
  partnerLoginHref,
} from "@/lib/auth/customer-auth-links";

function platformCssVars(): CSSProperties {
  const c = kubhaiBrand.colors;
  return {
    ["--store-primary" as string]: c.navy800,
    ["--store-secondary" as string]: c.navy950,
    ["--store-accent" as string]: c.accent,
    ["--store-ink" as string]: c.ink,
    ["--store-paper" as string]: "#f6f3ee",
    ["--store-line" as string]: c.line,
  };
}

function platformPresentation(returnTo: string): CustomerAuthPresentation {
  return {
    kind: "PLATFORM",
    displayName: "KubHai",
    shortName: "ขับให้",
    logoUrl: kubhaiBrand.logoSrc,
    loginSubtitle: "เข้าสู่บัญชีขับให้",
    signupSubtitle: "สมัครบัญชีขับให้ครั้งเดียว ใช้ได้กับพาร์ทเนอร์หลายร้าน",
    heroTitle: "เที่ยวเหนือ ไปกับขับให้",
    heroBody: "บัญชีเดียวสำหรับค้นหาที่เที่ยวและจองกับพาร์ทเนอร์",
    backHref: "/",
    backLabel: "กลับหน้าขับให้",
    returnTo,
    partnerBrand: null,
    cssVars: platformCssVars(),
    poweredByKubHaiEnabled: false,
  };
}

function partnerPresentation(brand: BusinessBranding, returnTo: string): CustomerAuthPresentation {
  return {
    kind: "PARTNER",
    displayName: brand.businessName,
    shortName: brand.shortName,
    logoUrl: brand.logoUrl,
    loginSubtitle: "เข้าสู่ระบบเพื่อดูการจองของคุณ",
    signupSubtitle: `สมัครบัญชีเพื่อจัดการการจองกับ ${brand.shortName}`,
    heroTitle: `เดินทางกับ ${brand.shortName}`,
    heroBody: "จัดการการจองของคุณได้ง่ายในที่เดียว",
    backHref: `/s/${brand.slug}`,
    backLabel: "กลับหน้าร้าน",
    returnTo,
    partnerBrand: brand,
    cssVars: brandingCssVars(brand),
    // Customer surfaces never show KubHai chrome — even if store flag is on.
    poweredByKubHaiEnabled: false,
  };
}

/**
 * Resolve auth presentation from explicit query params only.
 * `store` must match an ACTIVE public store slug — never trust last-store cookie here.
 */
export async function resolveCustomerAuthPresentation(input: {
  storeSlug?: string | null;
  context?: string | null;
  next?: string | null;
}): Promise<CustomerAuthPresentation> {
  const wantsPlatform =
    input.context === "platform" ||
    input.context === "kubhai" ||
    (!input.storeSlug?.trim() && input.context !== "partner");

  const explicitSlug = input.storeSlug?.trim().toLowerCase() || null;

  // Explicit partner store wins when valid — even if context=platform was also passed by mistake.
  if (explicitSlug) {
    const store = await getStore().getPublicStore(explicitSlug);
    if (store?.business) {
      const brand = resolveCustomerStorefrontBranding(store.business);
      const fallbackReturn = `/s/${brand.slug}`;
      return partnerPresentation(brand, sanitizeCustomerReturnTo(input.next, fallbackReturn));
    }
    // Invalid store slug → platform (never POND fallback)
  }

  if (wantsPlatform || !explicitSlug) {
    return platformPresentation(sanitizeCustomerReturnTo(input.next, "/"));
  }

  return platformPresentation(sanitizeCustomerReturnTo(input.next, "/"));
}
