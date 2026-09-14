/**
 * Customer identity domain — Supabase-Auth-ready boundary.
 *
 * ONE CENTRAL CustomerAccount (verified phone) → MANY Partner bookings.
 * Do NOT create per-store authentication identities.
 *
 * Tenant CRM `Customer` rows remain business-scoped for Partner operational data.
 * Platform session cookie `kh_customer_session` is shared across / and /s/{slug}.
 *
 * Verified phone is the primary booking identity.
 * Social providers (Google/Facebook) never bypass phone verification.
 * Do not merge accounts by display name alone.
 */

export type AuthProviderKind = "PHONE" | "GOOGLE" | "FACEBOOK";

export type CustomerAccountStatus = "ACTIVE" | "DISABLED";

export type CustomerAccount = {
  id: string;
  phone: string | null;
  phoneNormalized: string | null;
  phoneVerifiedAt: string | null;
  email: string | null;
  displayName: string | null;
  /** scrypt$salt$hash — never plaintext */
  passwordHash: string | null;
  status: CustomerAccountStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type CustomerIdentity = {
  id: string;
  customerAccountId: string;
  provider: AuthProviderKind;
  providerSubjectId: string;
  providerEmail: string | null;
  linkedAt: string;
};

export type EarlyCompletionReason =
  | "CUSTOMER_REQUEST"
  | "FINISHED_EARLY"
  | "PLAN_CHANGED"
  | "EMERGENCY"
  | "OTHER";

export const EARLY_COMPLETION_REASONS: EarlyCompletionReason[] = [
  "CUSTOMER_REQUEST",
  "FINISHED_EARLY",
  "PLAN_CHANGED",
  "EMERGENCY",
  "OTHER",
];

export const EARLY_COMPLETION_LABELS: Record<EarlyCompletionReason, string> = {
  CUSTOMER_REQUEST: "ลูกค้าขอจบก่อน",
  FINISHED_EARLY: "งานเสร็จก่อนกำหนด",
  PLAN_CHANGED: "เปลี่ยนแผนการเดินทาง",
  EMERGENCY: "เหตุฉุกเฉิน",
  OTHER: "อื่น ๆ",
};

/** Normalize Thai mobile numbers to 0xxxxxxxxx when possible. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("66") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizePhone(a) === normalizePhone(b);
}

export function isPhoneVerified(account: CustomerAccount, now = Date.now()): boolean {
  void now;
  return Boolean(account.phoneVerifiedAt && account.phoneNormalized);
}

/**
 * Repeat / duplicate prevention:
 * - One CustomerAccount per verified phoneNormalized
 * - Social identity links to an existing account when providerSubjectId matches
 * - Linking social → phone account requires verified phone on the account (or completing OTP)
 * - Never merge solely by displayName / email guess without verified identity
 */
export function canLinkSocialToAccount(account: CustomerAccount): boolean {
  return account.status === "ACTIVE";
}

export function requiresPhoneBeforeBooking(account: CustomerAccount | null): boolean {
  if (!account) return true;
  return !isPhoneVerified(account);
}
