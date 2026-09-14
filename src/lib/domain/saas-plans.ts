/**
 * Public SaaS plan catalog for Store Admin «แพ็กเกจและการชำระเงิน».
 * Features come from booking-entitlements — this file owns commercial presentation only.
 *
 * Resource limits come from `planResourceLimits`. Only finalized caps are advertised;
 * a `null` cap (staff, bookings, and Business fleet size) is omitted, never called unlimited.
 */

import {
  BOOKING_CAPABILITY_LABELS,
  listBookingCapabilities,
  normalizeSubscriptionPlan,
  planResourceLimits,
  type BookingCapability,
  type SubscriptionPlanId,
} from "./booking-entitlements";

export type PublicSaasPlanId = "starter" | "pro" | "business";

export type SaasPlanCatalogEntry = {
  id: PublicSaasPlanId;
  /** Internal entitlement plan id */
  entitlementPlanId: SubscriptionPlanId;
  nameTh: string;
  priceMonthlyThb: number;
  tagline: string;
  highlights: string[];
  /** Capability keys unlocked — resolved via entitlement layer */
  capabilityKeys: BookingCapability[];
};

/**
 * Fleet-size line for a plan card. Only renders caps the entitlement layer has
 * finalized — an unset cap is omitted rather than described as "unlimited".
 */
function resourceHighlight(plan: SubscriptionPlanId): string {
  const { maxVehicles, maxDrivers } = planResourceLimits(plan);
  const parts: string[] = [];
  if (maxVehicles !== null) parts.push(`รถที่เปิดใช้งาน ${maxVehicles} คัน`);
  if (maxDrivers !== null) parts.push(`คนขับที่เปิดใช้งาน ${maxDrivers} คน`);
  return parts.join(" · ");
}

/** Commercial notice shown on billing page (not an error). */
export const SAAS_PLAN_CHANGE_NOTICE_TH =
  "หมายเหตุ: รายละเอียด ราคา และสิทธิประโยชน์ของแต่ละแพ็กเกจอาจมีการปรับเปลี่ยนตามการพัฒนาและการเพิ่มความสามารถของระบบ KubHai ในอนาคต หากมีการเปลี่ยนแปลงที่มีผลต่อแพ็กเกจที่ใช้งานอยู่ ระบบจะแจ้งรายละเอียดและวันที่มีผลให้ทราบล่วงหน้า";

export const PUBLIC_SAAS_PLANS: SaasPlanCatalogEntry[] = [
  {
    id: "starter",
    entitlementPlanId: "starter",
    nameTh: "Starter",
    priceMonthlyThb: 599,
    tagline: "เริ่มต้นจัดการร้านและรับคำขอจอง",
    highlights: [
      "งานจอง · รถ · คนขับ · ปฏิทิน · ใบเสนอราคา",
      "หน้าร้านลูกค้าใต้แบรนด์ KubHai (ภาษาไทย)",
      resourceHighlight("starter"),
    ],
    capabilityKeys: listBookingCapabilities("starter"),
  },
  {
    id: "pro",
    entitlementPlanId: "pro",
    nameTh: "Pro",
    priceMonthlyThb: 999,
    tagline: "หน้าร้านแบรนด์ตัวเอง พร้อมลูกค้าต่างชาติ",
    highlights: [
      "ทุกอย่างใน Starter",
      "หน้าร้านลูกค้าแบรนด์ตัวเอง · ภาพ Hero · ธีม",
      "ภาษาลูกค้า TH/EN/中文 · เที่ยวแนะนำ · แพ็กเกจทริป",
      resourceHighlight("pro"),
    ],
    capabilityKeys: listBookingCapabilities("pro"),
  },
  {
    id: "business",
    entitlementPlanId: "business",
    nameTh: "Business",
    priceMonthlyThb: 1599,
    tagline: "ขยายการแสดงผลและการจัดวาง",
    highlights: [
      "ทุกอย่างใน Pro",
      "รูปแบบเลย์เอาต์",
      "ส่วนแสดงผลเพิ่มเติม",
    ],
    capabilityKeys: listBookingCapabilities("business"),
  },
];

export function publicPlanFromSubscription(
  plan: string | null | undefined,
): PublicSaasPlanId {
  const id = normalizeSubscriptionPlan(plan);
  if (id === "business" || id === "enterprise") return "business";
  if (id === "pro") return "pro";
  return "starter";
}

/** Enterprise maps to Business card for public 3-plan UI (enterprise remains for entitlement). */
export function catalogEntryForSubscription(
  plan: string | null | undefined,
): SaasPlanCatalogEntry {
  const publicId = publicPlanFromSubscription(plan);
  return PUBLIC_SAAS_PLANS.find((item) => item.id === publicId) ?? PUBLIC_SAAS_PLANS[0];
}

export function formatPlanPriceThb(amount: number): string {
  return `฿${amount.toLocaleString("th-TH")}`;
}

export function capabilityLabelsForPlan(plan: string | null | undefined): string[] {
  return listBookingCapabilities(plan).map((key) => BOOKING_CAPABILITY_LABELS[key]);
}

/**
 * KubHai SaaS receiving channels — Partner → KubHai.
 * Never reuse Partner customer payment accounts.
 * Return null fields when not configured (do not fabricate).
 */
export type KubHaiSaasPaymentConfig = {
  configured: boolean;
  promptPayId: string | null;
  promptPayQrUrl: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  note: string | null;
};

export function resolveKubHaiSaasPaymentConfig(): KubHaiSaasPaymentConfig {
  const promptPayId = process.env.KUBHAI_SAAS_PROMPTPAY_ID?.trim() || null;
  const promptPayQrUrl = process.env.KUBHAI_SAAS_PROMPTPAY_QR_URL?.trim() || null;
  const bankName = process.env.KUBHAI_SAAS_BANK_NAME?.trim() || null;
  const bankAccountName = process.env.KUBHAI_SAAS_BANK_ACCOUNT_NAME?.trim() || null;
  const bankAccountNumber = process.env.KUBHAI_SAAS_BANK_ACCOUNT_NUMBER?.trim() || null;
  const configured = Boolean(
    promptPayId || promptPayQrUrl || (bankName && bankAccountNumber),
  );
  return {
    configured,
    promptPayId,
    promptPayQrUrl,
    bankName,
    bankAccountName,
    bankAccountNumber,
    note: configured
      ? "ชำระค่าบริการระบบ KubHai (แยกจากเงินจองของลูกค้า)"
      : null,
  };
}

export type SaasSubscriptionPaymentStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export const SAAS_PAYMENT_STATUS_LABEL: Record<SaasSubscriptionPaymentStatus, string> = {
  PENDING: "รอชำระ",
  IN_REVIEW: "รอตรวจสอบ",
  PAID: "ชำระแล้ว",
  OVERDUE: "เกินกำหนด",
  CANCELLED: "ยกเลิก",
};

/** Plan-change announcements for Partner notification inbox (foundation). */
export type SaasPlanAnnouncement = {
  id: string;
  title: string;
  shortMessage: string;
  details: string | null;
  effectiveDate: string | null;
  createdAt: string;
  /** When false, show as unread in store notification merge */
  read?: boolean;
};

/** Empty by default — do not fabricate historical commercial changes. */
export function listSaasPlanAnnouncements(): SaasPlanAnnouncement[] {
  return [];
}
