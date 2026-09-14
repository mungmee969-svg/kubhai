/**
 * Operational presentation for ตารางเดินรถ job list.
 * Maps existing Booking + DriverDayWorkLog — does not invent a Job model.
 */

import { serviceDayCount, resolveDayWorkStatus, type DriverDayStatus } from "./driver-job";
import { bookingEndDate, overlapsDate } from "./fleet";
import type { Booking, DriverDayWorkLog, DriverJobLink } from "./types";

export type OpsJobFilter = "ALL" | "WAIT_START" | "IN_PROGRESS" | "DONE";

export const OPS_JOB_FILTERS: { key: OpsJobFilter; label: string }[] = [
  { key: "ALL", label: "ทั้งหมด" },
  { key: "WAIT_START", label: "รอเริ่มงาน" },
  { key: "IN_PROGRESS", label: "กำลังดำเนินงาน" },
  { key: "DONE", label: "เสร็จแล้ว" },
];

export type OpsJobStatus = "WAIT_START" | "IN_PROGRESS" | "DONE";

export const OPS_JOB_STATUS_LABEL: Record<OpsJobStatus, string> = {
  WAIT_START: "รอเริ่มงาน",
  IN_PROGRESS: "กำลังดำเนินงาน",
  DONE: "เสร็จแล้ว",
};

/** Confirmed operational bookings only (post deposit approval). */
export function isOperationalDispatchBooking(booking: Pick<Booking, "status">): boolean {
  return (
    booking.status === "CONFIRMED" ||
    booking.status === "IN_PROGRESS" ||
    booking.status === "COMPLETED"
  );
}

export function operationalDispatchBookings(bookings: Booking[]): Booking[] {
  return bookings.filter(isOperationalDispatchBooking);
}

export function bookingsInDispatchRange(
  bookings: Booking[],
  range: { start: string; end: string },
): Booking[] {
  return operationalDispatchBookings(bookings).filter(
    (item) => item.startDate <= range.end && bookingEndDate(item) >= range.start,
  );
}

export function bookingsOnSelectedDispatchDate(
  bookings: Booking[],
  date: string | null,
  range: { start: string; end: string },
): Booking[] {
  const inRange = bookingsInDispatchRange(bookings, range);
  if (!date) return inRange;
  return inRange.filter((item) => overlapsDate(item, date));
}

function logsForBooking(logs: DriverDayWorkLog[], bookingId: string): DriverDayWorkLog[] {
  return logs.filter((item) => item.bookingId === bookingId);
}

/**
 * Booking-level operational status for list rows.
 * Multi-day: IN_PROGRESS if any day ACTIVE; DONE only when booking COMPLETED
 * or every day is DAY_COMPLETED; otherwise WAIT_START if not started.
 */
export function resolveOpsJobStatus(
  booking: Booking,
  dayLogs: DriverDayWorkLog[] = [],
): OpsJobStatus {
  if (booking.status === "COMPLETED") return "DONE";

  const logs = logsForBooking(dayLogs, booking.id);
  const statuses = logs.map((log) => resolveDayWorkStatus(log));
  if (statuses.some((s) => s === "ACTIVE")) return "IN_PROGRESS";

  // All known service days completed → operationally done (finance may still be open)
  const expectedDays = serviceDayCount(booking);
  const completedDays = statuses.filter((s) => s === "DAY_COMPLETED").length;
  if (completedDays >= expectedDays && completedDays > 0) return "DONE";

  if (booking.status === "IN_PROGRESS") return "IN_PROGRESS";
  return "WAIT_START";
}

export function matchesOpsJobFilter(
  booking: Booking,
  dayLogs: DriverDayWorkLog[],
  filter: OpsJobFilter,
): boolean {
  if (filter === "ALL") return true;
  return resolveOpsJobStatus(booking, dayLogs) === filter;
}

export function sortOpsJobs(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    const ta = a.startTime ?? "99:99";
    const tb = b.startTime ?? "99:99";
    return ta.localeCompare(tb) || a.bookingCode.localeCompare(b.bookingCode);
  });
}

export function driverLinkForBooking(
  links: DriverJobLink[],
  bookingId: string,
): DriverJobLink | null {
  return links.find((item) => item.bookingId === bookingId && item.status === "ACTIVE") ?? null;
}

export function dayStatusSummary(
  booking: Booking,
  dayLogs: DriverDayWorkLog[],
): { label: string; days: { dayNumber: number; status: DriverDayStatus }[] } {
  const logs = logsForBooking(dayLogs, booking.id);
  const days = logs
    .map((log) => ({ dayNumber: log.dayNumber, status: resolveDayWorkStatus(log) }))
    .sort((a, b) => a.dayNumber - b.dayNumber);
  const status = resolveOpsJobStatus(booking, dayLogs);
  return { label: OPS_JOB_STATUS_LABEL[status], days };
}
