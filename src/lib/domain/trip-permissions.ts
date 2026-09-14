/**
 * Trip operational permissions — separate from financial permissions.
 * Store staff may check in / start / complete service without payment rights.
 */

import type { Actor } from "./types";
import type { Role } from "./enums";

export type TripOpsPermission =
  | "CHECK_IN_PICKUP"
  | "START_TRIP"
  | "CHECK_IN_DROPOFF"
  | "COMPLETE_TRIP";

const STORE_TRIP_ROLES: Role[] = ["BUSINESS_OWNER", "BUSINESS_STAFF", "SUPER_ADMIN"];

/** Financial actions remain gated elsewhere — never implied by trip ops. */
export const FINANCIAL_PERMISSIONS = [
  "APPROVE_PAYMENT_PROOF",
  "MARK_CASH_RECEIVED",
  "RECORD_PAYOUT",
  "MODIFY_QUOTATION",
] as const;

export function canTripOps(actor: Actor, permission: TripOpsPermission): boolean {
  if (actor.kind !== "user") return false;
  if (actor.role === "CUSTOMER") return false;
  if (!STORE_TRIP_ROLES.includes(actor.role)) return false;
  void permission; // all four trip ops share the same store-staff gate in MVP
  return true;
}

export function assertTripOps(actor: Actor, permission: TripOpsPermission) {
  if (!canTripOps(actor, permission)) {
    throw new Error(`ไม่มีสิทธิ์ ${permission}`);
  }
}
