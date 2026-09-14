/**
 * Store Admin reporting — single source of business metrics.
 *
 * Definitions (MVP):
 * - Period booking metrics use booking.startDate within [start, end] (Bangkok YYYY-MM-DD).
 * - Cash metrics use MoneyMovement.occurredAt date (Bangkok) within range; pending slips never count.
 * - Tip (TIP_RECEIVED / TIP_PAYOUT) is always separated from service revenue.
 * - "รถออกกี่คัน" = distinct assigned vehicle IDs on qualifying bookings in range.
 * - "กี่งาน" / "กี่รอบ" = number of those bookings (no itinerary-leg inflation).
 * - "วันใช้งาน" = sum of bookingSpanDays for those bookings.
 * - Completion rate = completed / eligible, where eligible =
 *   COMPLETED | CANCELLED | REJECTED | CONFIRMED | IN_PROGRESS | WAITING_DEPOSIT | CUSTOMER_CONFIRMED | QUOTATION_SENT
 *   (excludes early REQUESTED / CHECKING_AVAILABILITY / AVAILABLE).
 * - Repeat customer (period): customerId with ≥1 booking in period AND ≥1 prior booking before period start.
 * - Historical repeat: customerId with total qualifying bookings > 1.
 * - ผลต่างรับ-จ่าย = totalCashIn − totalCashOut (not net accounting profit).
 */

import { bookingSpanDays } from "./fleet";
import { SERVICE_TYPE_LABELS, type BookingStatus, type ServiceType } from "./enums";
import { addDays, monthPrefix, todayBangkok } from "./ops";
import { effectiveQuotationStatus } from "./quotation";
import { money, settleBooking, sumKind } from "./settlement";
import type {
  Booking,
  Customer,
  Driver,
  MoneyMovement,
  PaymentProof,
  Quotation,
  Vehicle,
} from "./types";

export type ReportPreset = "today" | "last7" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

export type ReportDateRange = {
  preset: ReportPreset;
  start: string;
  end: string;
  label: string;
};

export type ReportRowRef = {
  id: string;
  kind: "booking" | "vehicle" | "driver" | "customer" | "route" | "quotation" | "proof";
  label: string;
  sublabel?: string;
  amount?: number | null;
  href?: string;
  meta?: Record<string, string | number | null | undefined>;
};

const ELIGIBLE: BookingStatus[] = [
  "QUOTATION_SENT",
  "CUSTOMER_CONFIRMED",
  "WAITING_DEPOSIT",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
];

function bangkokDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function bookingInPeriod(booking: Booking, start: string, end: string) {
  return inRange(booking.startDate, start, end);
}

function movementInPeriod(movement: MoneyMovement, start: string, end: string) {
  return inRange(bangkokDate(movement.occurredAt), start, end);
}

export function resolveReportRange(
  preset: ReportPreset,
  customStart?: string | null,
  customEnd?: string | null,
  today = todayBangkok(),
): ReportDateRange {
  const month = monthPrefix(today);
  const [y, m] = month.split("-").map(Number);
  const lastMonthDate = new Date(Date.UTC(y, m - 2, 1));
  const lastMonth = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const lastDay = (ym: string) => {
    const [yy, mm] = ym.split("-").map(Number);
    const d = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    return `${ym}-${String(d).padStart(2, "0")}`;
  };

  switch (preset) {
    case "today":
      return { preset, start: today, end: today, label: "วันนี้" };
    case "last7":
      return { preset, start: addDays(today, -6), end: today, label: "7 วัน" };
    case "thisMonth":
      return { preset, start: `${month}-01`, end: lastDay(month), label: "เดือนนี้" };
    case "lastMonth":
      return { preset, start: `${lastMonth}-01`, end: lastDay(lastMonth), label: "เดือนก่อน" };
    case "thisYear":
      return { preset, start: `${y}-01-01`, end: `${y}-12-31`, label: "ปีนี้" };
    case "custom": {
      const start = customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart) ? customStart : today;
      const end = customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : start;
      return {
        preset,
        start: start <= end ? start : end,
        end: start <= end ? end : start,
        label: "กำหนดเอง",
      };
    }
  }
}

function routeKey(booking: Booking) {
  const pickup = booking.pickupLocation.trim();
  const dropoff = (booking.dropoffLocation ?? "").trim() || "—";
  return `${pickup} → ${dropoff}`;
}

function pct(num: number, den: number) {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

export type StoreReportInput = {
  businessId: string;
  range: ReportDateRange;
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  customers: Customer[];
  movements: MoneyMovement[];
  quotations: Quotation[];
  proofs: PaymentProof[];
};

export type StoreReport = ReturnType<typeof buildStoreReport>;

export function buildStoreReport(input: StoreReportInput) {
  const { range } = input;
  const bookings = input.bookings.filter((item) => item.businessId === input.businessId);
  const vehicles = input.vehicles.filter((item) => item.businessId === input.businessId);
  const drivers = input.drivers.filter((item) => item.businessId === input.businessId);
  const customers = input.customers.filter((item) => item.businessId === input.businessId);
  const movements = input.movements.filter((item) => item.businessId === input.businessId);
  const quotations = input.quotations.filter((item) => item.businessId === input.businessId);
  const proofs = input.proofs.filter((item) => item.businessId === input.businessId);

  const periodBookings = bookings.filter((item) => bookingInPeriod(item, range.start, range.end));
  const periodMovements = movements.filter((item) => movementInPeriod(item, range.start, range.end));

  const byStatus = (status: BookingStatus) => periodBookings.filter((item) => item.status === status).length;

  const completed = byStatus("COMPLETED");
  const cancelled = byStatus("CANCELLED");
  const rejected = byStatus("REJECTED");
  const inProgress = byStatus("IN_PROGRESS") + byStatus("CONFIRMED") + byStatus("WAITING_DEPOSIT") + byStatus("CUSTOMER_CONFIRMED");
  const eligible = periodBookings.filter((item) => ELIGIBLE.includes(item.status)).length;

  const depositIn = sumKind(periodMovements, "DEPOSIT");
  const serviceIn = sumKind(periodMovements, "SERVICE_BALANCE");
  const tipIn = sumKind(periodMovements, "TIP_RECEIVED");
  const serviceRevenue = depositIn + serviceIn;
  const totalCashIn = serviceRevenue + tipIn;

  const driverOut = sumKind(periodMovements, "DRIVER_PAYOUT");
  const partnerOut = sumKind(periodMovements, "PARTNER_PAYOUT");
  const tipOut = sumKind(periodMovements, "TIP_PAYOUT");
  const operationalPayouts = driverOut + partnerOut;
  const totalCashOut = operationalPayouts + tipOut;
  const cashDifference = totalCashIn - totalCashOut;
  const serviceCashDifference = serviceRevenue - operationalPayouts;

  const settlements = bookings.map((booking) => ({
    booking,
    settlement: settleBooking(
      booking,
      movements.filter((item) => item.bookingId === booking.id),
    ),
  }));

  const outstandingReceivable = settlements.filter(
    (item) => (item.settlement.remainingBalance ?? 0) > 0 && item.booking.status !== "CANCELLED" && item.booking.status !== "REJECTED",
  );
  const outstandingDriver = settlements.filter((item) => item.settlement.driverDue > 0);
  const outstandingTip = settlements.filter((item) => item.settlement.tipDue > 0);
  const outstandingPartner = settlements.filter((item) => {
    if (item.settlement.driverDue <= 0) return false;
    const vehicle = vehicles.find((row) => row.id === item.booking.assignedVehicleId);
    return vehicle?.ownershipType === "PARTNER";
  });

  function fleetUsage(ownership: "OWN" | "PARTNER") {
    const fleet = vehicles.filter((item) => item.ownershipType === ownership);
    const jobs = periodBookings.filter((item) => {
      if (!item.assignedVehicleId) return false;
      const vehicle = vehicles.find((row) => row.id === item.assignedVehicleId);
      return vehicle?.ownershipType === ownership;
    });
    const usedIds = new Set(jobs.map((item) => item.assignedVehicleId!).filter(Boolean));
    const perVehicle = fleet
      .map((vehicle) => {
        const vehicleJobs = jobs.filter((item) => item.assignedVehicleId === vehicle.id);
        if (!vehicleJobs.length) return null;
        const serviceDays = vehicleJobs.reduce((sum, item) => sum + bookingSpanDays(item), 0);
        const serviceValue = vehicleJobs.reduce((sum, item) => sum + money(item.quotedTotal), 0);
        return {
          vehicle,
          jobs: vehicleJobs.length,
          trips: vehicleJobs.length,
          serviceDays,
          completed: vehicleJobs.filter((item) => item.status === "COMPLETED").length,
          serviceValue,
          rows: vehicleJobs.map((item) => ({
            id: item.id,
            kind: "booking" as const,
            label: item.bookingCode,
            sublabel: item.customerNameSnapshot,
            href: `/store/bookings/${item.id}`,
          })),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.jobs - a.jobs || b.serviceDays - a.serviceDays);

    const partnerPaidOnJobs =
      ownership === "PARTNER"
        ? sumKind(
            periodMovements.filter((item) => jobs.some((job) => job.id === item.bookingId)),
            "PARTNER_PAYOUT",
          )
        : 0;

    return {
      vehiclesUsed: usedIds.size,
      jobs: jobs.length,
      trips: jobs.length,
      serviceDays: jobs.reduce((sum, item) => sum + bookingSpanDays(item), 0),
      completed: jobs.filter((item) => item.status === "COMPLETED").length,
      serviceValue: jobs.reduce((sum, item) => sum + money(item.quotedTotal), 0),
      partnerPaid: partnerPaidOnJobs,
      partnerDue: ownership === "PARTNER"
        ? jobs.reduce((sum, job) => {
            const settlement = settlements.find((row) => row.booking.id === job.id)?.settlement;
            return sum + (settlement?.driverDue ?? 0);
          }, 0)
        : 0,
      perVehicle,
      jobRows: jobs.map((item) => ({
        id: item.id,
        kind: "booking" as const,
        label: item.bookingCode,
        sublabel: item.customerNameSnapshot,
        href: `/store/bookings/${item.id}`,
      })),
    };
  }

  const own = fleetUsage("OWN");
  const partner = fleetUsage("PARTNER");

  const driverRows = drivers
    .map((driver) => {
      const jobs = periodBookings.filter((item) => item.assignedDriverId === driver.id);
      if (!jobs.length) return null;
      const jobIds = new Set(jobs.map((item) => item.id));
      const related = periodMovements.filter((item) => jobIds.has(item.bookingId));
      const pending = jobs.reduce((sum, job) => {
        const settlement = settlements.find((row) => row.booking.id === job.id)?.settlement;
        return sum + (settlement?.driverDue ?? 0) + (settlement?.tipDue ?? 0);
      }, 0);
      return {
        driver,
        jobs: jobs.length,
        completed: jobs.filter((item) => item.status === "COMPLETED").length,
        serviceDays: jobs.reduce((sum, item) => sum + bookingSpanDays(item), 0),
        driverPayout: sumKind(related, "DRIVER_PAYOUT") + sumKind(related, "PARTNER_PAYOUT"),
        tipPayout: sumKind(related, "TIP_PAYOUT"),
        pendingPayout: pending,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.jobs - a.jobs || b.driverPayout - a.driverPayout);

  const periodCustomerIds = new Set(
    periodBookings.map((item) => item.customerId).filter((id): id is string => Boolean(id)),
  );
  const historicalByCustomer = new Map<string, Booking[]>();
  for (const booking of bookings) {
    if (!booking.customerId) continue;
    const list = historicalByCustomer.get(booking.customerId) ?? [];
    list.push(booking);
    historicalByCustomer.set(booking.customerId, list);
  }

  let newCustomers = 0;
  let returningCustomers = 0;
  let repeatInPeriod = 0;
  for (const customerId of periodCustomerIds) {
    const all = historicalByCustomer.get(customerId) ?? [];
    const before = all.filter((item) => item.startDate < range.start);
    const inPeriod = all.filter((item) => bookingInPeriod(item, range.start, range.end));
    if (before.length === 0) newCustomers += 1;
    else {
      returningCustomers += 1;
      repeatInPeriod += 1;
    }
    if (all.length > 1 && inPeriod.length >= 1 && before.length === 0 && inPeriod.length > 1) {
      // first-time in history but multiple in period still counts as period activity; already new
    }
  }

  const topCustomers = [...periodCustomerIds]
    .map((customerId) => {
      const customer = customers.find((item) => item.id === customerId) ?? null;
      const jobs = periodBookings.filter((item) => item.customerId === customerId);
      const all = historicalByCustomer.get(customerId) ?? [];
      return {
        customerId,
        name: customer?.name ?? jobs[0]?.customerNameSnapshot ?? "ลูกค้า",
        jobs: jobs.length,
        completed: jobs.filter((item) => item.status === "COMPLETED").length,
        serviceValue: jobs.reduce((sum, item) => sum + money(item.quotedTotal), 0),
        isRepeat: all.length > 1,
      };
    })
    .sort((a, b) => b.jobs - a.jobs || b.serviceValue - a.serviceValue)
    .slice(0, 10);

  const routeMap = new Map<string, { route: string; count: number; completed: number }>();
  for (const booking of periodBookings) {
    const key = routeKey(booking);
    const row = routeMap.get(key) ?? { route: key, count: 0, completed: 0 };
    row.count += 1;
    if (booking.status === "COMPLETED") row.completed += 1;
    routeMap.set(key, row);
  }
  const routes = [...routeMap.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  const periodQuotations = quotations.filter((item) => {
    const stamp = item.sentAt ?? item.createdAt;
    return inRange(bangkokDate(stamp), range.start, range.end);
  });
  const quoteStatus = (status: ReturnType<typeof effectiveQuotationStatus>) =>
    periodQuotations.filter((item) => effectiveQuotationStatus(item) === status).length;
  const acceptedQuotes = periodQuotations.filter((item) => effectiveQuotationStatus(item) === "CUSTOMER_ACCEPTED");
  const acceptedSalesTotal = acceptedQuotes.reduce((sum, item) => sum + money(item.totalAmount), 0);
  const avgAcceptedValue =
    acceptedQuotes.length > 0
      ? Math.round(acceptedSalesTotal / acceptedQuotes.length)
      : null;

  const periodProofs = proofs.filter((item) => inRange(bangkokDate(item.submittedAt), range.start, range.end));

  // Funnel: count bookings that reached each stage (current status implies earlier stages)
  const stage = {
    request: periodBookings.length,
    quotationSent: periodBookings.filter((item) =>
      ["QUOTATION_SENT", "CUSTOMER_CONFIRMED", "WAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(item.status),
    ).length,
    priceAccepted: periodBookings.filter((item) =>
      ["CUSTOMER_CONFIRMED", "WAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(item.status) ||
      Boolean(item.acceptedQuotationId),
    ).length,
    depositApproved: periodBookings.filter((item) => {
      const settlement = settlements.find((row) => row.booking.id === item.id)?.settlement;
      return (settlement?.depositReceived ?? 0) > 0 || ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(item.status);
    }).length,
    confirmed: periodBookings.filter((item) =>
      ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(item.status),
    ).length,
    completed,
  };

  const bookingsByDay = new Map<string, number>();
  for (const booking of periodBookings) {
    bookingsByDay.set(booking.startDate, (bookingsByDay.get(booking.startDate) ?? 0) + 1);
  }
  const cashByDay = new Map<string, { in: number; out: number }>();
  for (const movement of periodMovements) {
    const day = bangkokDate(movement.occurredAt);
    const row = cashByDay.get(day) ?? { in: 0, out: 0 };
    if (movement.direction === "IN") row.in += money(movement.transferAmount);
    else row.out += money(movement.transferAmount);
    cashByDay.set(day, row);
  }

  const salesByDay = new Map<string, { sales: number; received: number }>();
  for (const quote of acceptedQuotes) {
    const day = bangkokDate(quote.acceptedAt ?? quote.sentAt ?? quote.createdAt);
    if (!inRange(day, range.start, range.end)) continue;
    const row = salesByDay.get(day) ?? { sales: 0, received: 0 };
    row.sales += money(quote.totalAmount);
    salesByDay.set(day, row);
  }
  for (const movement of periodMovements) {
    if (movement.direction !== "IN") continue;
    const servicePart =
      sumKind([movement], "DEPOSIT") + sumKind([movement], "SERVICE_BALANCE");
    if (servicePart <= 0) continue;
    const day = bangkokDate(movement.occurredAt);
    const row = salesByDay.get(day) ?? { sales: 0, received: 0 };
    row.received += servicePart;
    salesByDay.set(day, row);
  }

  const serviceMixMap = new Map<ServiceType, { count: number; revenue: number }>();
  for (const booking of periodBookings) {
    const row = serviceMixMap.get(booking.serviceType) ?? { count: 0, revenue: 0 };
    row.count += 1;
    row.revenue += money(booking.quotedTotal);
    serviceMixMap.set(booking.serviceType, row);
  }
  const serviceMixTotal = periodBookings.length;
  const serviceMix = [...serviceMixMap.entries()]
    .map(([key, row]) => ({
      key,
      label: SERVICE_TYPE_LABELS[key],
      count: row.count,
      share: pct(row.count, serviceMixTotal),
      revenue: row.revenue,
    }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);

  const paymentMixMap = new Map<string, { count: number; amount: number }>();
  for (const movement of periodMovements) {
    if (movement.direction !== "IN") continue;
    const tipOnly = sumKind([movement], "TIP_RECEIVED");
    const servicePart =
      sumKind([movement], "DEPOSIT") + sumKind([movement], "SERVICE_BALANCE");
    if (servicePart <= 0 && tipOnly <= 0) continue;
    // Tip stays separate — payment mix is approved service cash methods only.
    if (servicePart <= 0) continue;
    const method = (movement.method ?? "").trim() || "ไม่ระบุ";
    const row = paymentMixMap.get(method) ?? { count: 0, amount: 0 };
    row.count += 1;
    row.amount += servicePart;
    paymentMixMap.set(method, row);
  }
  const paymentMix = [...paymentMixMap.entries()]
    .map(([method, row]) => ({ method, count: row.count, amount: row.amount }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count);

  return {
    range,
    empty: periodBookings.length === 0 && periodMovements.length === 0,
    overview: {
      bookings: periodBookings.length,
      completed,
      cancelled: cancelled + rejected,
      completionRate: pct(completed, eligible),
      serviceRevenue,
      tipReceived: tipIn,
      totalCashIn,
      operationalPayouts,
      tipPaidOut: tipOut,
      totalCashOut,
      cashDifference,
      serviceCashDifference,
      eligible,
    },
    booking: {
      total: periodBookings.length,
      requested: byStatus("REQUESTED"),
      checking: byStatus("CHECKING_AVAILABILITY"),
      available: byStatus("AVAILABLE"),
      quotationSent: byStatus("QUOTATION_SENT"),
      customerConfirmed: byStatus("CUSTOMER_CONFIRMED"),
      waitingDeposit: byStatus("WAITING_DEPOSIT"),
      confirmed: byStatus("CONFIRMED"),
      inProgress: byStatus("IN_PROGRESS"),
      completed,
      cancelled,
      rejected,
      inProgressBucket: inProgress,
      eligible,
      completionRate: pct(completed, eligible),
      cancellationRate: pct(cancelled + rejected, periodBookings.length),
      funnel: [
        { key: "request", label: "คำขอ", count: stage.request, rate: pct(stage.request, stage.request) },
        { key: "quotation", label: "เสนอราคา", count: stage.quotationSent, rate: pct(stage.quotationSent, stage.request) },
        { key: "accepted", label: "ยืนยันราคา", count: stage.priceAccepted, rate: pct(stage.priceAccepted, stage.quotationSent) },
        { key: "deposit", label: "มัดจำ", count: stage.depositApproved, rate: pct(stage.depositApproved, stage.priceAccepted) },
        { key: "confirmed", label: "ยืนยันงาน", count: stage.confirmed, rate: pct(stage.confirmed, stage.depositApproved || stage.priceAccepted) },
        { key: "completed", label: "สำเร็จ", count: stage.completed, rate: pct(stage.completed, stage.confirmed) },
      ],
      completedRows: periodBookings
        .filter((item) => item.status === "COMPLETED")
        .map((item) => ({
          id: item.id,
          kind: "booking" as const,
          label: item.bookingCode,
          sublabel: item.customerNameSnapshot,
          href: `/store/bookings/${item.id}`,
        })),
      cancelledRows: periodBookings
        .filter((item) => item.status === "CANCELLED" || item.status === "REJECTED")
        .map((item) => ({
          id: item.id,
          kind: "booking" as const,
          label: item.bookingCode,
          sublabel: `${item.customerNameSnapshot} · ${item.status === "REJECTED" ? "ปฏิเสธ" : "ยกเลิก"} · ไม่ระบุเหตุผล`,
          href: `/store/bookings/${item.id}`,
        })),
      allRows: periodBookings.map((item) => ({
        id: item.id,
        kind: "booking" as const,
        label: item.bookingCode,
        sublabel: `${item.customerNameSnapshot} · ${item.status}`,
        href: `/store/bookings/${item.id}`,
      })),
    },
    income: {
      deposit: depositIn,
      serviceBalance: serviceIn,
      tipReceived: tipIn,
      serviceRevenue,
      totalCashIn,
    },
    expense: {
      driverPayout: driverOut,
      partnerPayout: partnerOut,
      tipPayout: tipOut,
      operationalPayouts,
      totalCashOut,
    },
    outstanding: {
      receivableAmount: outstandingReceivable.reduce((sum, item) => sum + (item.settlement.remainingBalance ?? 0), 0),
      receivableCount: outstandingReceivable.length,
      driverAmount: outstandingDriver.reduce((sum, item) => sum + item.settlement.driverDue, 0),
      driverCount: outstandingDriver.length,
      partnerAmount: outstandingPartner.reduce((sum, item) => sum + item.settlement.driverDue, 0),
      partnerCount: outstandingPartner.length,
      tipAmount: outstandingTip.reduce((sum, item) => sum + item.settlement.tipDue, 0),
      tipCount: outstandingTip.length,
      receivableRows: outstandingReceivable.map((item) => ({
        id: item.booking.id,
        kind: "booking" as const,
        label: item.booking.bookingCode,
        sublabel: item.booking.customerNameSnapshot,
        amount: item.settlement.remainingBalance,
        href: `/store/bookings/${item.booking.id}`,
      })),
      payoutRows: outstandingDriver.map((item) => ({
        id: item.booking.id,
        kind: "booking" as const,
        label: item.booking.bookingCode,
        sublabel: item.booking.customerNameSnapshot,
        amount: item.settlement.driverDue,
        href: `/store/bookings/${item.booking.id}`,
      })),
    },
    own,
    partner,
    drivers: driverRows,
    customers: {
      periodCustomers: periodCustomerIds.size,
      newCustomers,
      returningCustomers,
      repeatInPeriod,
      historicalRepeat: [...historicalByCustomer.values()].filter((list) => list.length > 1).length,
      topCustomers,
    },
    routes,
    quotation: {
      sent: periodQuotations.filter((item) => item.sentAt || ["SENT", "CUSTOMER_ACCEPTED", "CUSTOMER_CHANGE_REQUESTED", "CUSTOMER_REJECTED", "EXPIRED", "SUPERSEDED"].includes(effectiveQuotationStatus(item))).length,
      accepted: quoteStatus("CUSTOMER_ACCEPTED"),
      acceptedSalesTotal,
      changeRequested: quoteStatus("CUSTOMER_CHANGE_REQUESTED"),
      rejected: quoteStatus("CUSTOMER_REJECTED"),
      expired: quoteStatus("EXPIRED"),
      acceptanceRate: pct(quoteStatus("CUSTOMER_ACCEPTED"), Math.max(1, periodQuotations.filter((item) => item.sentAt).length)),
      avgAcceptedValue,
    },
    proofs: {
      submitted: periodProofs.length,
      approved: periodProofs.filter((item) => item.reviewStatus === "APPROVED").length,
      rejected: periodProofs.filter((item) => item.reviewStatus === "REJECTED").length,
      pending: periodProofs.filter((item) => item.reviewStatus === "PENDING_REVIEW").length,
    },
    charts: {
      bookingsByDay: [...bookingsByDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count })),
      cashByDay: [...cashByDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, row]) => ({ date, ...row })),
      salesByDay: [...salesByDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, row]) => ({ date, ...row })),
      serviceMix,
      paymentMix,
      ownVsPartner: [
        { key: "OWN", label: "รถตัวเอง", jobs: own.jobs, vehicles: own.vehiclesUsed },
        { key: "PARTNER", label: "รถทีม", jobs: partner.jobs, vehicles: partner.vehiclesUsed },
      ],
    },
    help: {
      cashDifference:
        "ตัวเลขนี้เป็นผลต่างจากรายการรับ-จ่ายที่บันทึกในงาน ไม่ใช่กำไรสุทธิทางบัญชี",
      trips: "MVP นับ 1 งาน = 1 รอบ ตามการมอบหมาย ไม่แตกตามจุดในแผนทริป",
      completion:
        "อัตราสำเร็จ = งานสำเร็จ ÷ งานที่เข้าสู่ขั้นเสนอราคา/ยืนยันแล้ว (ไม่นับคำขอที่ยังไม่ถึง QUOTATION_SENT)",
      repeat:
        "ลูกค้าจองซ้ำในช่วง = มีงานในช่วง และเคยมีงานก่อนวันเริ่มช่วง",
    },
  };
}

export function monthOverviewFromReport(report: StoreReport) {
  return {
    bookings: report.overview.bookings,
    completed: report.overview.completed,
    cancelled: report.overview.cancelled,
    cashIn: report.overview.totalCashIn,
    cashOut: report.overview.totalCashOut,
    receivable: report.outstanding.receivableAmount,
    payoutDue: report.outstanding.driverAmount + report.outstanding.tipAmount,
    ownVehicles: report.own.vehiclesUsed,
    ownJobs: report.own.jobs,
    partnerVehicles: report.partner.vehiclesUsed,
    partnerJobs: report.partner.jobs,
  };
}
