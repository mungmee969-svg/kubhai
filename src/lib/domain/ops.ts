import { findAssignmentConflict, findAssignmentWarning, rangesOverlap } from "./availability";
import { isBlockingStatus } from "./booking-rules";
import { listSaasPlanAnnouncements } from "./saas-plans";
import type {
  Booking,
  Customer,
  Driver,
  DriverDayWorkLog,
  DriverRouteSuggestion,
  PaymentProof,
  Quotation,
  Vehicle,
} from "./types";

function dayWorkStatus(log: DriverDayWorkLog | null | undefined): "NOT_STARTED" | "ACTIVE" | "DAY_COMPLETED" {
  if (!log) return "NOT_STARTED";
  if (log.endedAt) return "DAY_COMPLETED";
  if (log.startedAt) return "ACTIVE";
  return "NOT_STARTED";
}

export type ResourceState = "FREE" | "BUSY" | "SOFT" | "UNAVAILABLE";

export const RESOURCE_STATE_LABEL: Record<ResourceState, string> = {
  FREE: "ว่าง",
  BUSY: "มีงานชน",
  SOFT: "มีงานรอยืนยัน",
  UNAVAILABLE: "ไม่พร้อมใช้งาน",
};

const MONTHS_TH = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00+07:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export function formatThaiDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} ${MONTHS_TH[month - 1]}`;
}

export function formatThaiMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  if (!year || !month) return isoDate;
  return `${MONTHS_TH[month - 1]} ${year + 543}`;
}

export function formatThaiDayMonth(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} ${MONTHS_TH[month - 1]}`;
}

export function formatThaiDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const day = formatThaiDate(date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }));
  const time = date.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day} ${time}`;
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `฿${value.toLocaleString("th-TH")}`;
}

export function monthPrefix(now = todayBangkok()): string {
  return now.slice(0, 7);
}

export function resourceState(input: {
  active: boolean;
  unavailable?: boolean;
  bookings: Booking[];
  resourceId: string;
  kind: "vehicle" | "driver";
  range: { startDate: string; endDate: string | null };
  ignoreBookingId?: string;
}): ResourceState {
  if (!input.active || input.unavailable) return "UNAVAILABLE";
  const hard = findAssignmentConflict({
    bookings: input.bookings,
    vehicleId: input.kind === "vehicle" ? input.resourceId : null,
    driverId: input.kind === "driver" ? input.resourceId : null,
    range: input.range,
    ignoreBookingId: input.ignoreBookingId,
  });
  if ((input.kind === "vehicle" && hard.vehicle) || (input.kind === "driver" && hard.driver)) {
    return "BUSY";
  }
  const soft = findAssignmentWarning({
    bookings: input.bookings,
    vehicleId: input.kind === "vehicle" ? input.resourceId : null,
    driverId: input.kind === "driver" ? input.resourceId : null,
    range: input.range,
    ignoreBookingId: input.ignoreBookingId,
  });
  if ((input.kind === "vehicle" && soft.vehicle) || (input.kind === "driver" && soft.driver)) {
    return "SOFT";
  }
  return "FREE";
}

export function nextJobFor(
  bookings: Booking[],
  resourceId: string,
  kind: "vehicle" | "driver",
  fromDate = todayBangkok(),
): Booking | null {
  return (
    bookings
      .filter((booking) => {
        if (booking.status === "CANCELLED" || booking.status === "REJECTED" || booking.status === "COMPLETED") {
          return false;
        }
        const assigned =
          kind === "vehicle"
            ? booking.assignedVehicleId === resourceId
            : booking.assignedDriverId === resourceId;
        return assigned && booking.startDate >= fromDate;
      })
      .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`))[0] ?? null
  );
}

export function currentJobFor(
  bookings: Booking[],
  resourceId: string,
  kind: "vehicle" | "driver",
  date = todayBangkok(),
): Booking | null {
  return (
    bookings.find((booking) => {
      const assigned =
        kind === "vehicle"
          ? booking.assignedVehicleId === resourceId
          : booking.assignedDriverId === resourceId;
      return assigned && isBlockingStatus(booking.status) && rangesOverlap(booking, { startDate: date, endDate: date });
    }) ?? null
  );
}

export function fleetSummary(vehicles: Vehicle[], drivers: Driver[], bookings: Booking[], date = todayBangkok()) {
  const range = { startDate: date, endDate: date };
  const vehicleStates = vehicles.map((vehicle) =>
    resourceState({
      active: vehicle.active,
      unavailable: vehicle.status !== "ACTIVE",
      bookings,
      resourceId: vehicle.id,
      kind: "vehicle",
      range,
    }),
  );
  const driverStates = drivers.map((driver) =>
    resourceState({
      active: driver.active,
      unavailable: driver.status !== "ACTIVE",
      bookings,
      resourceId: driver.id,
      kind: "driver",
      range,
    }),
  );
  return {
    vehicles: {
      total: vehicles.length,
      free: vehicleStates.filter((state) => state === "FREE").length,
      busy: vehicleStates.filter((state) => state === "BUSY" || state === "SOFT").length,
      unavailable: vehicleStates.filter((state) => state === "UNAVAILABLE").length,
    },
    drivers: {
      total: drivers.length,
      free: driverStates.filter((state) => state === "FREE").length,
      busy: driverStates.filter((state) => state === "BUSY" || state === "SOFT").length,
      unavailable: driverStates.filter((state) => state === "UNAVAILABLE").length,
    },
  };
}

export function financeFromBookings(bookings: Booking[], month = monthPrefix()) {
  const monthRows = bookings.filter((item) => item.startDate.startsWith(month));
  const real = (values: Array<number | null | undefined>) =>
    values.filter((value): value is number => typeof value === "number");
  const quoted = real(monthRows.map((item) => item.quotedTotal));
  const deposits = real(monthRows.map((item) => item.depositAmount));
  const paid = monthRows.reduce((sum, item) => sum + (item.paidAmount || 0), 0);
  const balances = real(monthRows.map((item) => item.balanceAmount));
  return {
    monthBookings: monthRows.length,
    completed: monthRows.filter((item) => item.status === "COMPLETED").length,
    cancelled: monthRows.filter((item) => item.status === "CANCELLED" || item.status === "REJECTED").length,
    quotedTotal: quoted.length ? quoted.reduce((a, b) => a + b, 0) : null,
    depositTotal: deposits.length ? deposits.reduce((a, b) => a + b, 0) : null,
    paidTotal: paid || null,
    balanceTotal: balances.length ? balances.reduce((a, b) => a + b, 0) : null,
    waitingDeposit: monthRows.filter((item) => item.status === "WAITING_DEPOSIT").length,
  };
}

export type OpsNotificationKind =
  | "booking"
  | "payment"
  | "driver"
  | "quotation"
  | "saas_plan"
  | "ops";

export type OpsNotification = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  kind?: OpsNotificationKind;
  read?: boolean;
  badge?: "bookings" | "finance" | "drivers" | "billing";
};

export type DeriveNotificationsInput = {
  bookings: Booking[];
  proofs?: PaymentProof[];
  quotations?: Quotation[];
  dayLogs?: DriverDayWorkLog[];
  suggestions?: DriverRouteSuggestion[];
  readIds?: Set<string> | string[];
  now?: string;
};

function notificationIsRead(id: string, readIds?: Set<string> | string[]): boolean {
  if (!readIds) return false;
  if (readIds instanceof Set) return readIds.has(id);
  return readIds.includes(id);
}

export function deriveNotifications(
  bookingsOrInput: Booking[] | DeriveNotificationsInput,
  nowArg = todayBangkok(),
): OpsNotification[] {
  const input: DeriveNotificationsInput = Array.isArray(bookingsOrInput)
    ? { bookings: bookingsOrInput, now: nowArg }
    : bookingsOrInput;
  const now = input.now ?? todayBangkok();
  const tomorrow = addDays(now, 1);
  const items: OpsNotification[] = [];
  const bookings = input.bookings;

  for (const ann of listSaasPlanAnnouncements()) {
    if (ann.read) continue;
    const id = `saas-${ann.id}`;
    items.push({
      id,
      title: ann.title,
      body: ann.shortMessage,
      href: "/store/billing",
      createdAt: ann.createdAt,
      kind: "saas_plan",
      badge: "billing",
      read: notificationIsRead(id, input.readIds),
    });
  }

  for (const booking of bookings) {
    if (booking.status === "REQUESTED") {
      const id = `req-${booking.id}`;
      items.push({
        id,
        title: "มีคำขอจองใหม่",
        body: `${booking.bookingCode} · ${booking.customerNameSnapshot}`,
        href: `/store/bookings/${booking.id}`,
        createdAt: booking.createdAt,
        kind: "booking",
        badge: "bookings",
        read: notificationIsRead(id, input.readIds),
      });
    }
    if (booking.status === "CUSTOMER_CONFIRMED") {
      const id = `confirm-${booking.id}`;
      items.push({
        id,
        title: "ลูกค้ายืนยันใบเสนอราคา",
        body: booking.bookingCode,
        href: `/store/bookings/${booking.id}`,
        createdAt: booking.updatedAt,
        kind: "quotation",
        badge: "bookings",
        read: notificationIsRead(id, input.readIds),
      });
    }
    if (booking.status === "WAITING_DEPOSIT") {
      const id = `dep-${booking.id}`;
      items.push({
        id,
        title: "รอมัดจำ",
        body: booking.bookingCode,
        href: `/store/bookings/${booking.id}`,
        createdAt: booking.updatedAt,
        kind: "payment",
        badge: "finance",
        read: notificationIsRead(id, input.readIds),
      });
    }
    if (booking.status === "CANCELLED") {
      const id = `can-${booking.id}`;
      items.push({
        id,
        title: "Booking ถูกยกเลิก",
        body: booking.bookingCode,
        href: `/store/bookings/${booking.id}`,
        createdAt: booking.updatedAt,
        kind: "booking",
        badge: "bookings",
        read: notificationIsRead(id, input.readIds),
      });
    }
    const upcoming = booking.startDate === tomorrow || booking.startDate === now;
    const open =
      booking.status !== "CANCELLED" &&
      booking.status !== "REJECTED" &&
      booking.status !== "COMPLETED";
    if (upcoming && open && !booking.assignedVehicleId) {
      const id = `nov-${booking.id}`;
      items.push({
        id,
        title: booking.startDate === tomorrow ? "งานพรุ่งนี้ยังไม่มีรถ" : "งานวันนี้ยังไม่มีรถ",
        body: booking.bookingCode,
        href: `/store/bookings/${booking.id}`,
        createdAt: booking.updatedAt,
        kind: "booking",
        badge: "bookings",
        read: notificationIsRead(id, input.readIds),
      });
    }
    if (upcoming && open && !booking.assignedDriverId) {
      const id = `nod-${booking.id}`;
      items.push({
        id,
        title: booking.startDate === tomorrow ? "งานพรุ่งนี้ยังไม่มีคนขับ" : "งานวันนี้ยังไม่มีคนขับ",
        body: booking.bookingCode,
        href: `/store/bookings/${booking.id}`,
        createdAt: booking.updatedAt,
        kind: "booking",
        badge: "bookings",
        read: notificationIsRead(id, input.readIds),
      });
    }
  }

  for (const proof of input.proofs ?? []) {
    if (proof.reviewStatus !== "PENDING_REVIEW") continue;
    const booking = bookings.find((item) => item.id === proof.bookingId);
    const id = `proof-pending-${proof.id}`;
    items.push({
      id,
      title: "มีสลิปรอตรวจสอบ",
      body: booking?.bookingCode ?? proof.bookingId.slice(0, 8),
      href: `/store/bookings/${proof.bookingId}`,
      createdAt: proof.createdAt,
      kind: "payment",
      badge: "finance",
      read: notificationIsRead(id, input.readIds),
    });
  }

  for (const quote of input.quotations ?? []) {
    if (quote.status === "CUSTOMER_CHANGE_REQUESTED") {
      const id = `q-change-${quote.id}`;
      items.push({
        id,
        title: "ลูกค้าขอแก้ไขใบเสนอราคา",
        body: quote.quotationNumber,
        href: `/store/bookings/${quote.bookingId}`,
        createdAt: quote.changeRequestedAt ?? quote.updatedAt,
        kind: "quotation",
        badge: "bookings",
        read: notificationIsRead(id, input.readIds),
      });
    }
    if (quote.status === "CUSTOMER_REJECTED") {
      const id = `q-rej-${quote.id}`;
      items.push({
        id,
        title: "ลูกค้าปฏิเสธใบเสนอราคา",
        body: quote.quotationNumber,
        href: `/store/bookings/${quote.bookingId}`,
        createdAt: quote.updatedAt,
        kind: "quotation",
        badge: "bookings",
        read: notificationIsRead(id, input.readIds),
      });
    }
  }

  for (const log of input.dayLogs ?? []) {
    const booking = bookings.find((item) => item.id === log.bookingId);
    const status = dayWorkStatus(log);
    if (status === "ACTIVE" && log.startedAt) {
      const id = `drv-start-${log.id}`;
      items.push({
        id,
        title: "คนขับเริ่มงานแล้ว",
        body: `${booking?.bookingCode ?? ""} · วันที่ ${log.dayNumber}`.trim(),
        href: `/store/bookings/${log.bookingId}`,
        createdAt: log.startedAt,
        kind: "driver",
        badge: "drivers",
        read: notificationIsRead(id, input.readIds),
      });
    }
    if (status === "DAY_COMPLETED" && log.endedAt) {
      const id = `drv-end-${log.id}`;
      const balanceNote =
        booking && (booking.balanceAmount ?? 0) > 0 ? " — มียอดคงเหลือรอดำเนินการ" : "";
      items.push({
        id,
        title: "คนขับจบงานแล้ว",
        body: `${booking?.bookingCode ?? ""} · วันที่ ${log.dayNumber}${balanceNote}`.trim(),
        href: `/store/bookings/${log.bookingId}`,
        createdAt: log.endedAt,
        kind: "driver",
        badge: "drivers",
        read: notificationIsRead(id, input.readIds),
      });
    }
  }

  for (const suggestion of input.suggestions ?? []) {
    if (suggestion.status !== "OPEN") continue;
    const booking = bookings.find((item) => item.id === suggestion.bookingId);
    const id = `drv-sug-${suggestion.id}`;
    items.push({
      id,
      title: "คนขับแนะนำปรับเส้นทาง",
      body: `${booking?.bookingCode ?? ""} · ${suggestion.body.slice(0, 80)}`.trim(),
      href: `/store/bookings/${suggestion.bookingId}`,
      createdAt: suggestion.createdAt,
      kind: "driver",
      badge: "bookings",
      read: notificationIsRead(id, input.readIds),
    });
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
}

export function notificationBadgeCounts(items: OpsNotification[]) {
  const unread = items.filter((item) => !item.read);
  return {
    /** Unread notification *events* (header bell) */
    total: unread.length,
    /**
     * @deprecated Prefer bookingWorkloadBadgeCount for งานจอง nav.
     * Raw unread rows with badge=bookings (can exceed unique bookings).
     */
    bookingsEvents: unread.filter((item) => item.badge === "bookings").length,
    bookings: unread.filter((item) => item.badge === "bookings").length,
    finance: unread.filter((item) => item.badge === "finance").length,
    drivers: unread.filter((item) => item.badge === "drivers").length,
    billing: unread.filter((item) => item.badge === "billing").length,
  };
}

/**
 * งานจอง sidebar badge = unique actionable Booking IDs needing store attention.
 * NOT the number of notification events for those bookings.
 */
export function bookingWorkloadBadgeCount(
  bookings: Booking[],
  pendingProofBookingIds: Set<string> | string[] = [],
): number {
  const pending =
    pendingProofBookingIds instanceof Set
      ? pendingProofBookingIds
      : new Set(pendingProofBookingIds);
  const ids = new Set<string>();
  for (const booking of bookings) {
    if (
      booking.status === "CANCELLED" ||
      booking.status === "REJECTED" ||
      booking.status === "COMPLETED" ||
      booking.status === "CONFIRMED" ||
      booking.status === "IN_PROGRESS"
    ) {
      continue;
    }
    if (pending.has(booking.id)) {
      ids.add(booking.id);
      continue;
    }
    if (booking.status === "REQUESTED") {
      ids.add(booking.id);
      continue;
    }
    if (
      booking.status === "CHECKING_AVAILABILITY" ||
      booking.status === "AVAILABLE"
    ) {
      ids.add(booking.id);
      continue;
    }
  }
  return ids.size;
}

export function matchQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

export function searchBoard(
  query: string,
  input: {
    bookings: Booking[];
    customers: Customer[];
    vehicles: Vehicle[];
    drivers: Driver[];
  },
) {
  const q = query.trim();
  if (q.length < 2) {
    return { bookings: [], customers: [], vehicles: [], drivers: [] };
  }
  return {
    bookings: input.bookings
      .filter((item) =>
        matchQuery(
          `${item.bookingCode} ${item.customerNameSnapshot} ${item.customerPhoneSnapshot} ${item.pickupLocation} ${item.dropoffLocation ?? ""}`,
          q,
        ),
      )
      .slice(0, 8),
    customers: input.customers
      .filter((item) => matchQuery(`${item.name} ${item.phone ?? ""} ${item.email ?? ""}`, q))
      .slice(0, 6),
    vehicles: input.vehicles
      .filter((item) => matchQuery(`${item.brand} ${item.model} ${item.plateNumber ?? ""}`, q))
      .slice(0, 6),
    drivers: input.drivers
      .filter((item) => matchQuery(`${item.name} ${item.nickname ?? ""} ${item.phone ?? ""}`, q))
      .slice(0, 6),
  };
}

export function actionQueue(bookings: Booking[]) {
  const open = (status: Booking["status"]) =>
    bookings.filter((item) => item.status === status).length;
  return {
    REQUESTED: open("REQUESTED"),
    CHECKING_AVAILABILITY: open("CHECKING_AVAILABILITY"),
    NO_VEHICLE: bookings.filter(
      (item) =>
        !item.assignedVehicleId &&
        item.status !== "CANCELLED" &&
        item.status !== "REJECTED" &&
        item.status !== "COMPLETED",
    ).length,
    NO_DRIVER: bookings.filter(
      (item) =>
        !item.assignedDriverId &&
        item.status !== "CANCELLED" &&
        item.status !== "REJECTED" &&
        item.status !== "COMPLETED",
    ).length,
    AVAILABLE: open("AVAILABLE"),
    QUOTATION_SENT: open("QUOTATION_SENT"),
    WAITING_DEPOSIT: open("WAITING_DEPOSIT"),
  };
}
