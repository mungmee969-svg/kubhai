/**
 * Driver job access — secure link per assignment (no driver account for MVP).
 * Day work log: NOT_STARTED → ACTIVE → DAY_COMPLETED (no pause/resume).
 */

import type {
  Booking,
  BookingItineraryItem,
  DriverDayWorkLog,
  DriverJobLink,
  IsoDateTime,
} from "./types";
import { addDays, todayBangkok } from "./ops";

export type DriverDayStatus = "NOT_STARTED" | "ACTIVE" | "DAY_COMPLETED";

export const DRIVER_DAY_STATUS_LABEL: Record<DriverDayStatus, string> = {
  NOT_STARTED: "ยังไม่เริ่ม",
  ACTIVE: "กำลังดำเนินงาน",
  DAY_COMPLETED: "จบงานแล้ว",
};

export function isDriverJobLinkEligible(
  booking: Pick<Booking, "status">,
  proofs?: Array<Pick<PaymentProofLike, "bookingId" | "paymentIntent" | "reviewStatus">>,
  bookingId?: string,
): boolean {
  if (booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS" || booking.status === "COMPLETED") {
    return true;
  }
  if (!proofs || !bookingId) return false;
  return proofs.some(
    (item) =>
      item.bookingId === bookingId &&
      item.paymentIntent === "DEPOSIT" &&
      item.reviewStatus === "APPROVED",
  );
}

type PaymentProofLike = {
  bookingId: string;
  paymentIntent: string;
  reviewStatus: string;
};

export function driverJobPath(token: string): string {
  return `/driver/job/${token}`;
}

export function serviceDayCount(booking: Pick<Booking, "startDate" | "endDate">): number {
  if (!booking.endDate || booking.endDate <= booking.startDate) return 1;
  const start = new Date(`${booking.startDate}T00:00:00+07:00`);
  const end = new Date(`${booking.endDate}T00:00:00+07:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, days);
}

export function dateForDayNumber(
  booking: Pick<Booking, "startDate">,
  dayNumber: number,
): string {
  return addDays(booking.startDate, Math.max(0, dayNumber - 1));
}

export function resolveDayWorkStatus(
  log: DriverDayWorkLog | null | undefined,
): DriverDayStatus {
  if (!log) return "NOT_STARTED";
  if (log.endedAt) return "DAY_COMPLETED";
  if (log.startedAt) return "ACTIVE";
  return "NOT_STARTED";
}

export function elapsedMinutes(startedAt: string, endedAt: string): number {
  const a = Date.parse(startedAt);
  const b = Date.parse(endedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 60_000);
}

export function formatElapsed(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} นาที`;
  return `${h} ชม. ${m} นาที`;
}

export function formatTimeTh(iso: IsoDateTime | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mapsUrlForItem(item: Pick<BookingItineraryItem, "latitude" | "longitude" | "title" | "address" | "location">): string | null {
  if (item.latitude != null && item.longitude != null) {
    return `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
  }
  const q = item.address || item.location || item.title;
  if (!q?.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.trim())}`;
}

export function activeDriverJobLink(
  links: DriverJobLink[],
  bookingId: string,
): DriverJobLink | null {
  return (
    links.find((item) => item.bookingId === bookingId && item.status === "ACTIVE") ?? null
  );
}

export function dayRelativeLabel(dayDate: string, now = todayBangkok()): string {
  if (dayDate === now) return "วันนี้";
  if (dayDate === addDays(now, 1)) return "พรุ่งนี้";
  return "";
}

export function buildDayShell(
  booking: Pick<Booking, "startDate" | "endDate">,
): { dayNumber: number; dayDate: string }[] {
  const count = serviceDayCount(booking);
  return Array.from({ length: count }, (_, i) => ({
    dayNumber: i + 1,
    dayDate: dateForDayNumber(booking, i + 1),
  }));
}
