import { addDays, currentJobFor, nextJobFor, todayBangkok } from "./ops";
import type { Booking, Driver, Vehicle } from "./types";
import { resolveVehicleCoverUrl } from "./vehicle-image";

export type FleetVisualState = "AVAILABLE" | "ON_JOB" | "UPCOMING" | "UNAVAILABLE";

export const FLEET_VISUAL: Record<FleetVisualState, { label: string; badgeClass: string; blockClass: string }> = {
  AVAILABLE: {
    label: "ว่างวันนี้",
    badgeClass: "bg-success/15 text-success",
    blockClass: "bg-success/15 border-success/30",
  },
  ON_JOB: {
    label: "กำลังใช้งาน",
    badgeClass: "bg-navy-800 text-white",
    blockClass: "bg-navy-800 text-white border-navy-800",
  },
  UPCOMING: {
    label: "มีงานถัดไป",
    badgeClass: "bg-accent/20 text-navy-800",
    blockClass: "bg-accent/20 text-navy-800 border-accent/40",
  },
  UNAVAILABLE: {
    label: "ไม่พร้อมใช้งาน",
    badgeClass: "bg-line text-muted",
    blockClass: "bg-paper text-muted border-line",
  },
};

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 20 * 60;

export const DISPATCH_HOURS = [8, 10, 12, 14, 16, 18, 20] as const;

export function isObsoleteTestAsset(item: { brand?: string; model?: string; name?: string; description?: string | null }) {
  const hay = `${item.brand ?? ""} ${item.model ?? ""} ${item.name ?? ""} ${item.description ?? ""}`.toLowerCase();
  return hay.includes("phase2") || hay.includes("phase 2");
}

export function operationalVehicles(vehicles: Vehicle[]) {
  return vehicles.filter((item) => !isObsoleteTestAsset(item));
}

export function operationalDrivers(drivers: Driver[]) {
  return drivers.filter((item) => !isObsoleteTestAsset(item));
}

export function bookingEndDate(booking: Pick<Booking, "startDate" | "endDate">): string {
  return booking.endDate ?? booking.startDate;
}

export function bookingSpanDays(booking: Pick<Booking, "startDate" | "endDate">): number {
  const start = new Date(`${booking.startDate}T00:00:00+07:00`);
  const end = new Date(`${bookingEndDate(booking)}T00:00:00+07:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

export function formatDuration(booking: Pick<Booking, "startDate" | "endDate">): string {
  const days = bookingSpanDays(booking);
  if (days === 1) return "1 วัน";
  return `${days} วัน ${days - 1} คืน`;
}

export function parseClock(value: string | null | undefined): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function overlapsDate(booking: Pick<Booking, "startDate" | "endDate">, date: string): boolean {
  return booking.startDate <= date && bookingEndDate(booking) >= date;
}

export function bookingWindowOnDate(
  booking: Pick<Booking, "startDate" | "endDate" | "startTime" | "endTime">,
  date: string,
): { startMin: number; endMin: number; inferred: boolean } | null {
  if (!overlapsDate(booking, date)) return null;
  let inferred = false;
  let startMin = DAY_START_MIN;
  let endMin = DAY_END_MIN;

  if (booking.startDate === date) {
    const parsed = parseClock(booking.startTime);
    if (parsed !== null) startMin = parsed;
    else {
      startMin = DAY_START_MIN;
      inferred = true;
    }
  } else {
    startMin = DAY_START_MIN;
  }

  if (bookingEndDate(booking) === date) {
    const parsed = parseClock(booking.endTime);
    if (parsed !== null) endMin = parsed;
    else if (booking.startDate === date) {
      endMin = 17 * 60;
      inferred = true;
    } else {
      endMin = DAY_END_MIN;
    }
  } else {
    endMin = DAY_END_MIN;
  }

  if (endMin <= startMin) endMin = Math.min(DAY_END_MIN, startMin + 60);
  return { startMin, endMin, inferred };
}

export function timelineBlockStyle(
  booking: Pick<Booking, "startDate" | "endDate" | "startTime" | "endTime">,
  date: string,
): { left: string; width: string; inferred: boolean } | null {
  const window = bookingWindowOnDate(booking, date);
  if (!window) return null;
  const span = DAY_END_MIN - DAY_START_MIN;
  const left = Math.max(0, ((window.startMin - DAY_START_MIN) / span) * 100);
  const width = Math.max(3, ((window.endMin - window.startMin) / span) * 100);
  return { left: `${left}%`, width: `${Math.min(100 - left, width)}%`, inferred: window.inferred };
}

export function multiDayBlockStyle(
  booking: Pick<Booking, "startDate" | "endDate">,
  days: string[],
): { left: string; width: string } | null {
  if (!days.length) return null;
  const endDate = bookingEndDate(booking);
  if (endDate < days[0] || booking.startDate > days[days.length - 1]) return null;
  const start = days.findIndex((day) => day >= booking.startDate);
  const endIndex = days.findLastIndex((day) => day <= endDate);
  if (start < 0 || endIndex < start) return null;
  const left = (start / days.length) * 100;
  const width = ((endIndex - start + 1) / days.length) * 100;
  return { left: `${left}%`, width: `${width}%` };
}

export function datesInRange(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    const next = new Date(`${cursor}T00:00:00+07:00`);
    next.setDate(next.getDate() + 1);
    cursor = next.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  }
  return days;
}

export function monthRange(date: string) {
  const start = `${date.slice(0, 7)}-01`;
  const [year, month] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end: `${date.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

export function addMonths(date: string, delta: number): string {
  const [year, month] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function ownershipLabel(type: string): string {
  return type === "PARTNER" ? "รถทีม" : "รถร้าน";
}

export function fleetVisualState(
  resource: { id: string; active: boolean; status: string },
  bookings: Booking[],
  kind: "vehicle" | "driver",
  date = todayBangkok(),
): FleetVisualState {
  if (!resource.active || resource.status !== "ACTIVE") return "UNAVAILABLE";
  if (currentJobFor(bookings, resource.id, kind, date)) return "ON_JOB";
  const next = nextJobFor(bookings, resource.id, kind, date);
  if (next && overlapsDate(next, date)) return "ON_JOB";
  if (next) return "UPCOMING";
  return "AVAILABLE";
}

export function fleetVisualLabel(
  state: FleetVisualState,
  next: Booking | null,
): string {
  if (state === "UPCOMING" && next?.startTime) return `มีงานถัดไป ${next.startTime}`;
  return FLEET_VISUAL[state].label;
}

export function vehiclePhoto(vehicle: Vehicle): string {
  return resolveVehicleCoverUrl(vehicle);
}

export function driverInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

export function openJobs(bookings: Booking[]) {
  return bookings.filter(
    (item) => item.status !== "CANCELLED" && item.status !== "REJECTED" && item.status !== "COMPLETED",
  );
}

export function unassignedVehicleJobs(bookings: Booking[], range?: { start: string; end: string }) {
  return openJobs(bookings).filter((item) => {
    if (item.assignedVehicleId) return false;
    if (!range) return true;
    return item.startDate <= range.end && bookingEndDate(item) >= range.start;
  });
}

export function unassignedDriverJobs(bookings: Booking[], range?: { start: string; end: string }) {
  return openJobs(bookings).filter((item) => {
    if (item.assignedDriverId) return false;
    if (!range) return true;
    return item.startDate <= range.end && bookingEndDate(item) >= range.start;
  });
}

export function dispatchSummary(
  vehicles: Vehicle[],
  bookings: Booking[],
  date: string,
) {
  const ops = operationalVehicles(vehicles);
  const dayJobs = openJobs(bookings).filter((item) => overlapsDate(item, date));
  return {
    jobsToday: dayJobs.length,
    vehiclesOnJob: ops.filter((vehicle) => fleetVisualState(vehicle, bookings, "vehicle", date) === "ON_JOB").length,
    vehiclesFree: ops.filter((vehicle) => fleetVisualState(vehicle, bookings, "vehicle", date) === "AVAILABLE").length,
    noVehicle: dayJobs.filter((item) => !item.assignedVehicleId).length,
    noDriver: dayJobs.filter((item) => !item.assignedDriverId).length,
  };
}

export const WEEKDAY_LABELS_TH = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."] as const;
export const WEEKDAY_LABELS_FULL_TH = [
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัส",
  "ศุกร์",
  "เสาร์",
  "อาทิตย์",
] as const;

export type MonthCell = {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
};

/** Monday-first calendar cells for the month containing `date`. */
export function monthCalendarCells(date: string, today = todayBangkok()): MonthCell[] {
  const { start, end } = monthRange(date);
  const [year, month] = start.split("-").map(Number);
  const first = new Date(`${start}T00:00:00+07:00`);
  // JS: 0=Sun … convert to Mon=0 … Sun=6
  const mondayIndex = (first.getDay() + 6) % 7;
  const lead = addDays(start, -mondayIndex);
  const lastDay = Number(end.slice(8, 10));
  const total = Math.ceil((mondayIndex + lastDay) / 7) * 7;
  const cells: MonthCell[] = [];
  for (let i = 0; i < total; i += 1) {
    const cellDate = addDays(lead, i);
    cells.push({
      date: cellDate,
      day: Number(cellDate.slice(8, 10)),
      inMonth: cellDate.slice(0, 7) === `${year}-${String(month).padStart(2, "0")}`,
      isToday: cellDate === today,
    });
  }
  return cells;
}

export function activeJobs(bookings: Booking[]) {
  return bookings.filter((item) => item.status !== "CANCELLED" && item.status !== "REJECTED");
}

export function jobsOnDate(bookings: Booking[], date: string) {
  return activeJobs(bookings)
    .filter((item) => overlapsDate(item, date))
    .sort((a, b) => {
      const ta = a.startTime ?? "99:99";
      const tb = b.startTime ?? "99:99";
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      return ta.localeCompare(tb) || a.bookingCode.localeCompare(b.bookingCode);
    });
}

export function monthDispatchSummary(bookings: Booking[], monthDate: string) {
  const { start, end } = monthRange(monthDate);
  const monthJobs = activeJobs(bookings).filter(
    (item) => item.startDate <= end && bookingEndDate(item) >= start,
  );
  return {
    jobsMonth: monthJobs.length,
    confirmed: monthJobs.filter((item) => item.status === "CONFIRMED" || item.status === "IN_PROGRESS").length,
    completed: monthJobs.filter((item) => item.status === "COMPLETED").length,
    noVehicle: monthJobs.filter((item) => !item.assignedVehicleId && item.status !== "COMPLETED").length,
  };
}

export function weekStartMonday(date: string): string {
  const d = new Date(`${date}T00:00:00+07:00`);
  const mondayIndex = (d.getDay() + 6) % 7;
  return addDays(date, -mondayIndex);
}

/** True when two bookings on the same vehicle have overlapping service windows. */
export function bookingsTimeConflict(
  a: Pick<Booking, "startDate" | "endDate" | "startTime" | "endTime" | "assignedVehicleId" | "status">,
  b: Pick<Booking, "startDate" | "endDate" | "startTime" | "endTime" | "assignedVehicleId" | "status">,
): boolean {
  if (!a.assignedVehicleId || a.assignedVehicleId !== b.assignedVehicleId) return false;
  if (a.status === "CANCELLED" || a.status === "REJECTED") return false;
  if (b.status === "CANCELLED" || b.status === "REJECTED") return false;
  if (bookingEndDate(a) < b.startDate || bookingEndDate(b) < a.startDate) return false;
  // Multi-day overlap without needing clock precision
  if (a.startDate !== bookingEndDate(a) || b.startDate !== bookingEndDate(b)) {
    return bookingEndDate(a) >= b.startDate && bookingEndDate(b) >= a.startDate;
  }
  if (a.startDate !== b.startDate) return false;
  const wa = bookingWindowOnDate(a, a.startDate);
  const wb = bookingWindowOnDate(b, b.startDate);
  if (!wa || !wb) return true;
  return wa.startMin < wb.endMin && wb.startMin < wa.endMin;
}

export function vehicleHasConflict(bookings: Booking[], vehicleId: string, range?: { start: string; end: string }) {
  const jobs = activeJobs(bookings).filter((item) => {
    if (item.assignedVehicleId !== vehicleId) return false;
    if (!range) return true;
    return item.startDate <= range.end && bookingEndDate(item) >= range.start;
  });
  for (let i = 0; i < jobs.length; i += 1) {
    for (let j = i + 1; j < jobs.length; j += 1) {
      if (bookingsTimeConflict(jobs[i], jobs[j])) return true;
    }
  }
  return false;
}

export function dateHasVehicleConflict(bookings: Booking[], date: string) {
  const dayJobs = jobsOnDate(bookings, date).filter((item) => item.assignedVehicleId);
  const byVehicle = new Map<string, Booking[]>();
  for (const job of dayJobs) {
    const id = job.assignedVehicleId!;
    const list = byVehicle.get(id) ?? [];
    list.push(job);
    byVehicle.set(id, list);
  }
  for (const list of byVehicle.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (bookingsTimeConflict(list[i], list[j])) return true;
      }
    }
  }
  return false;
}

export function bookingConflictsWithOthers(booking: Booking, bookings: Booking[]) {
  if (!booking.assignedVehicleId) return false;
  return bookings.some(
    (item) => item.id !== booking.id && bookingsTimeConflict(booking, item),
  );
}
