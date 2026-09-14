import { createHash, randomInt } from "node:crypto";

/**
 * OTP provider abstraction — ready to swap for Supabase Phone Auth / SMS gateway.
 * Local DevOtpProvider is DEVELOPMENT/TEST only and must never be treated as production SMS.
 */

export type OtpPurpose = "SIGNUP" | "LOGIN_VERIFY" | "FORGOT_PASSWORD" | "BOOKING_VERIFY";

export type OtpIssueResult = {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
  /** Present ONLY when explicitly in development/test OTP mode. Never for production. */
  devCode?: string;
};

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "EXPIRED" | "USED" | "INVALID" | "LOCKED" | "NOT_FOUND" };

export type OtpChallengeRecord = {
  id: string;
  phoneNormalized: string;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  consumedAt: string | null;
  expiresAt: string;
  createdAt: string;
  lastSentAt: string;
  customerAccountId: string | null;
};

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_REQUESTS_PER_HOUR = 5;

/** Fixed pilot OTP — NEVER enabled in real production without explicit allow flags. */
export const PILOT_DEV_OTP = "123456";

/**
 * Development / pilot OTP mode.
 * Production: OFF unless BOTH KUBHAI_ALLOW_DEV_OTP=1 and KUBHAI_DEV_OTP=1.
 * Non-production: ON when KUBHAI_DEV_OTP is not explicitly "0".
 */
export function isDevOtpEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return process.env.KUBHAI_ALLOW_DEV_OTP === "1" && process.env.KUBHAI_DEV_OTP === "1";
  }
  return process.env.KUBHAI_DEV_OTP !== "0";
}

/** Server-only: whether the fixed pilot code path may be used. Same gate as isDevOtpEnabled. */
export function isPilotDevOtpEnabled(): boolean {
  return isDevOtpEnabled();
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(`kubhai-otp:${code}`).digest("hex");
}

export function generateOtpCode(): string {
  // Fixed pilot code only when explicitly in development/test OTP mode.
  // Production without allow flags never takes this branch.
  if (isPilotDevOtpEnabled()) {
    return PILOT_DEV_OTP;
  }
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashMatches(code: string, codeHash: string): boolean {
  return hashOtpCode(code) === codeHash;
}

/** Rate-limit helper: count challenges created for phone within the last hour. */
export function countRecentOtpRequests(
  challenges: { phoneNormalized: string; createdAt: string }[],
  phoneNormalized: string,
  nowMs = Date.now(),
): number {
  const cutoff = nowMs - 60 * 60 * 1000;
  return challenges.filter(
    (item) => item.phoneNormalized === phoneNormalized && Date.parse(item.createdAt) >= cutoff,
  ).length;
}
