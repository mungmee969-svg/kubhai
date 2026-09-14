/**
 * Booking presentation + storefront capabilities — plan → feature keys.
 * Prefer capability checks over hardcoded plan-name branches at call sites.
 */

export const BOOKING_CAPABILITIES = [
  "booking.customBranding",
  "booking.customHero",
  "booking.customTheme",
  "booking.customLayout",
  "booking.customSections",
  "booking.customDomain",
  /** Partner-owned customer storefront (/s/{slug} white-label) */
  "storefront.whiteLabel",
  /** Customer UI locales beyond Thai */
  "storefront.multilingualUi",
  /** Partner CMS localized marketing copy */
  "storefront.multilingualContent",
  /** Travel / places discovery on customer storefront */
  "storefront.tripDiscovery",
  /** Trip Package catalog + CMS */
  "storefront.tripPackages",
] as const;

export type BookingCapability = (typeof BOOKING_CAPABILITIES)[number];

/** starter = public Starter ฿599; pro = Pro ฿999; business = Business ฿1,599 */
export type SubscriptionPlanId = "starter" | "pro" | "business" | "enterprise";

const PLAN_ALIASES: Record<string, SubscriptionPlanId> = {
  starter: "starter",
  standard: "starter",
  partner: "starter",
  basic: "starter",
  free: "starter",
  pro: "pro",
  professional: "pro",
  business: "business",
  enterprise: "enterprise",
  custom: "enterprise",
};

const PLAN_CAPABILITIES: Record<SubscriptionPlanId, ReadonlySet<BookingCapability>> = {
  starter: new Set([
    // Ops branding in admin only — customer storefront is KubHai for Starter
  ]),
  pro: new Set([
    "booking.customBranding",
    "booking.customHero",
    "booking.customTheme",
    "storefront.whiteLabel",
    "storefront.multilingualUi",
    "storefront.multilingualContent",
    "storefront.tripDiscovery",
    "storefront.tripPackages",
  ]),
  business: new Set([
    "booking.customBranding",
    "booking.customHero",
    "booking.customTheme",
    "booking.customLayout",
    "booking.customSections",
    "storefront.whiteLabel",
    "storefront.multilingualUi",
    "storefront.multilingualContent",
    "storefront.tripDiscovery",
    "storefront.tripPackages",
  ]),
  enterprise: new Set([
    "booking.customBranding",
    "booking.customHero",
    "booking.customTheme",
    "booking.customLayout",
    "booking.customSections",
    "booking.customDomain",
    "storefront.whiteLabel",
    "storefront.multilingualUi",
    "storefront.multilingualContent",
    "storefront.tripDiscovery",
    "storefront.tripPackages",
  ]),
};

/** Defined resource caps — only finalize numbers that product has decided. */
export type PlanResourceLimits = {
  maxVehicles: number | null;
  /** null = not finalized — do not invent */
  maxDrivers: number | null;
};

const PLAN_LIMITS: Record<SubscriptionPlanId, PlanResourceLimits> = {
  starter: { maxVehicles: 3, maxDrivers: null },
  pro: { maxVehicles: 10, maxDrivers: 10 },
  business: { maxVehicles: null, maxDrivers: null },
  enterprise: { maxVehicles: null, maxDrivers: null },
};

/** Human labels for store owners (never show raw feature keys). */
export const BOOKING_CAPABILITY_LABELS: Record<BookingCapability, string> = {
  "booking.customBranding": "แบรนด์ร้าน",
  "booking.customHero": "ภาพ Hero ของร้าน",
  "booking.customTheme": "ธีมและข้อความต้อนรับ",
  "booking.customLayout": "รูปแบบเลย์เอาต์",
  "booking.customSections": "ส่วนแสดงผลเพิ่มเติม",
  "booking.customDomain": "โดเมนร้าน",
  "storefront.whiteLabel": "หน้าร้านลูกค้าแบรนด์ตัวเอง",
  "storefront.multilingualUi": "ภาษาลูกค้า TH/EN/中文",
  "storefront.multilingualContent": "เนื้อหาหน้าร้านหลายภาษา",
  "storefront.tripDiscovery": "เที่ยวแนะนำ / สถานที่",
  "storefront.tripPackages": "แพ็กเกจทริป",
};

export const PLAN_UNLOCK_HINT: Record<BookingCapability, string> = {
  "booking.customBranding": "ใช้ได้ในแพ็กเกจ Pro",
  "booking.customHero": "ใช้ได้ในแพ็กเกจ Pro",
  "booking.customTheme": "ใช้ได้ในแพ็กเกจ Pro",
  "booking.customLayout": "ใช้ได้ในแพ็กเกจ Business",
  "booking.customSections": "ใช้ได้ในแพ็กเกจ Business",
  "booking.customDomain": "ใช้ได้ในแพ็กเกจ Enterprise",
  "storefront.whiteLabel": "ใช้ได้ในแพ็กเกจ Pro",
  "storefront.multilingualUi": "ใช้ได้ในแพ็กเกจ Pro",
  "storefront.multilingualContent": "ใช้ได้ในแพ็กเกจ Pro",
  "storefront.tripDiscovery": "ใช้ได้ในแพ็กเกจ Pro",
  "storefront.tripPackages": "ใช้ได้ในแพ็กเกจ Pro",
};

export function normalizeSubscriptionPlan(
  plan: string | null | undefined,
): SubscriptionPlanId {
  if (!plan) return "starter";
  const key = plan.trim().toLowerCase();
  return PLAN_ALIASES[key] ?? "starter";
}

export function bookingCapabilitiesForPlan(
  plan: string | null | undefined,
): ReadonlySet<BookingCapability> {
  return PLAN_CAPABILITIES[normalizeSubscriptionPlan(plan)];
}

export function hasBookingCapability(
  plan: string | null | undefined,
  capability: BookingCapability,
): boolean {
  return bookingCapabilitiesForPlan(plan).has(capability);
}

export function listBookingCapabilities(
  plan: string | null | undefined,
): BookingCapability[] {
  return [...bookingCapabilitiesForPlan(plan)];
}

export function planResourceLimits(
  plan: string | null | undefined,
): PlanResourceLimits {
  return PLAN_LIMITS[normalizeSubscriptionPlan(plan)];
}

/** Store-owner message when a finalized plan cap blocks a create. */
export function planResourceLimitMessage(
  resource: "vehicles" | "drivers",
  max: number,
): string {
  return resource === "vehicles"
    ? `แพ็กเกจปัจจุบันเพิ่มรถที่เปิดใช้งานได้ ${max} คัน — อัปเกรดแพ็กเกจเพื่อเพิ่มรถ`
    : `แพ็กเกจปัจจุบันเพิ่มคนขับที่เปิดใช้งานได้ ${max} คน — อัปเกรดแพ็กเกจเพื่อเพิ่มคนขับ`;
}

export function isWhiteLabelStorefront(plan: string | null | undefined): boolean {
  return hasBookingCapability(plan, "storefront.whiteLabel");
}

export function allowsCustomerLocales(plan: string | null | undefined): boolean {
  return hasBookingCapability(plan, "storefront.multilingualUi");
}

export function allowsTripPackages(plan: string | null | undefined): boolean {
  return hasBookingCapability(plan, "storefront.tripPackages");
}

export function allowsTripDiscovery(plan: string | null | undefined): boolean {
  return hasBookingCapability(plan, "storefront.tripDiscovery");
}

/** Fields that require a premium capability to mutate. */
export const BOOKING_APPEARANCE_FIELD_CAPS: Record<string, BookingCapability> = {
  bookingHeroImageUrl: "booking.customHero",
  bookingMobileHeroImageUrl: "booking.customHero",
  bookingTagline: "booking.customTheme",
  bookingLayoutPreset: "booking.customLayout",
  bookingThemePreset: "booking.customTheme",
};

export function planUnlockHref(): string {
  return "/store/billing";
}
