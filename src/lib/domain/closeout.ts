/**
 * Job closeout — operational completion vs financial closeout.
 *
 * COMPLETED = service/job ended (may still have outstanding customer balance / payouts)
 * financiallyClosed = settleBooking.state === "CLOSED" (customer receipts + required payouts settled)
 *
 * Early completion must NOT change accepted quotation totals.
 * Pending payment proofs do NOT reduce outstanding — only approved MoneyMovements.
 */

import { EARLY_COMPLETION_REASONS, type EarlyCompletionReason } from "./customer-auth";
import { money, settleBooking, type Settlement } from "./settlement";
import type { Booking, MoneyMovement, Vehicle } from "./types";

export type BookingCloseout = {
  acceptedQuotationTotal: number | null;
  serviceCashReceived: number;
  depositReceived: number;
  serviceBalanceReceived: number;
  customerOutstanding: number | null;
  tipReceived: number;
  driverPayoutRequired: number | null;
  driverPayoutPaid: number;
  driverPayoutOutstanding: number;
  partnerPayoutRequired: number;
  partnerPayoutPaid: number;
  partnerPayoutOutstanding: number;
  tipPayoutRequired: number;
  tipPayoutPaid: number;
  tipPayoutOutstanding: number;
  operationallyCompleted: boolean;
  financiallyClosed: boolean;
  settlement: Settlement;
  outstandingBadge: string | null;
};

export function buildBookingCloseout(
  booking: Booking,
  movements: MoneyMovement[],
  opts?: { vehicle?: Vehicle | null },
): BookingCloseout {
  const settlement = settleBooking(booking, movements);
  const customerOutstanding = settlement.remainingBalance;
  const partnerPaid = settlement.partnerPaid;
  const driverPaid = settlement.driverPaid;
  // Partner vs driver split of required fee is ownership-based when known.
  const isPartner = opts?.vehicle?.ownershipType === "PARTNER";
  const fee = money(settlement.driverFee);
  const driverRequired = settlement.driverFee === null ? null : isPartner ? 0 : fee;
  const partnerRequired = settlement.driverFee === null ? 0 : isPartner ? fee : 0;

  const outstanding =
    customerOutstanding != null && customerOutstanding > 0 ? customerOutstanding : 0;

  return {
    acceptedQuotationTotal: settlement.serviceTotal,
    serviceCashReceived: settlement.customerPaidService,
    depositReceived: settlement.depositReceived,
    serviceBalanceReceived: settlement.serviceReceived,
    customerOutstanding,
    tipReceived: settlement.tipReceived,
    driverPayoutRequired: driverRequired,
    driverPayoutPaid: driverPaid,
    driverPayoutOutstanding: Math.max(0, money(driverRequired) - driverPaid),
    partnerPayoutRequired: partnerRequired,
    partnerPayoutPaid: partnerPaid,
    partnerPayoutOutstanding: Math.max(0, partnerRequired - partnerPaid),
    tipPayoutRequired: settlement.tipReceived,
    tipPayoutPaid: settlement.tipPaidOut,
    tipPayoutOutstanding: settlement.tipDue,
    operationallyCompleted: booking.status === "COMPLETED",
    financiallyClosed: settlement.state === "CLOSED",
    settlement,
    outstandingBadge:
      booking.status === "COMPLETED" && outstanding > 0
        ? `เสร็จสิ้น • ค้างชำระ ฿${outstanding.toLocaleString("th-TH")}`
        : null,
  };
}

export function scheduledEndMs(booking: Booking): number | null {
  const endDate = booking.endDate ?? booking.startDate;
  const endTime = booking.endTime ?? "23:59";
  const ms = Date.parse(`${endDate}T${endTime}:00+07:00`);
  return Number.isFinite(ms) ? ms : null;
}

export function isEarlyCompletion(booking: Booking, nowMs = Date.now()): boolean {
  const end = scheduledEndMs(booking);
  if (end == null) return false;
  return nowMs < end;
}

export function remainingScheduledDurationMs(booking: Booking, nowMs = Date.now()): number {
  const end = scheduledEndMs(booking);
  if (end == null) return 0;
  return Math.max(0, end - nowMs);
}

export function formatDurationMinutes(ms: number): string {
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} นาที`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}

export type CompleteBookingInput = {
  earlyCompletionReason?: EarlyCompletionReason | null;
  earlyCompletionNote?: string | null;
  /** Test / server clock override (ISO). */
  now?: string | null;
  acknowledgeOutstanding?: boolean;
};

export function assertEarlyCompletionAllowed(
  booking: Booking,
  input: CompleteBookingInput,
  nowMs = Date.now(),
): void {
  if (!isEarlyCompletion(booking, nowMs)) return;
  const reason = input.earlyCompletionReason;
  if (!reason || !EARLY_COMPLETION_REASONS.includes(reason)) {
    throw new Error("กำลังจบงานก่อนเวลาที่กำหนด — ต้องระบุเหตุผล");
  }
  if (reason === "OTHER" && !input.earlyCompletionNote?.trim()) {
    throw new Error("กรุณาระบุรายละเอียดเมื่อเลือกอื่น ๆ");
  }
}

export function scheduledEndIso(booking: Booking): string | null {
  const end = scheduledEndMs(booking);
  return end == null ? null : new Date(end).toISOString();
}
