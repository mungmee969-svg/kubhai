/**
 * Day-level availability for Store Admin calendar month view.
 * Does NOT equate "0 bookings" with AVAILABLE unless usable resources are known.
 */

import {
  bookingWindowOnDate,
  jobsOnDate,
  operationalVehicles,
} from "@/lib/domain/fleet";
import type { Booking, Driver, Vehicle } from "@/lib/domain/types";

export type DayAvailabilityStatus =
  | "AVAILABLE"
  | "BOOKED_AVAILABLE"
  | "NEAR_CAPACITY"
  | "FULL"
  | "UNKNOWN";

export const DAY_AVAILABILITY_LABELS: Record<DayAvailabilityStatus, string> = {
  AVAILABLE: "ว่าง",
  BOOKED_AVAILABLE: "มีคิว",
  NEAR_CAPACITY: "ใกล้เต็ม",
  FULL: "เต็ม",
  UNKNOWN: "ข้อมูลไม่พอ",
};

/** Remaining usable vehicles at or below this → near capacity. */
export const NEAR_CAPACITY_REMAINING = 1;

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 20 * 60;

/** Bookings that consume operational capacity (not cancelled/rejected/completed). */
export function capacityJobsOnDate(bookings: Booking[], date: string): Booking[] {
  return jobsOnDate(bookings, date).filter(
    (item) => item.status !== "COMPLETED" && item.status !== "CANCELLED" && item.status !== "REJECTED",
  );
}

export function usableFleetVehicles(vehicles: Vehicle[]): Vehicle[] {
  return operationalVehicles(vehicles).filter(
    (item) => item.active && item.status === "ACTIVE",
  );
}

function vehicleBusyWindows(
  vehicleId: string,
  jobs: Booking[],
  date: string,
): { startMin: number; endMin: number }[] {
  const windows: { startMin: number; endMin: number }[] = [];
  for (const job of jobs) {
    if (job.assignedVehicleId !== vehicleId) continue;
    const win = bookingWindowOnDate(job, date);
    if (!win) {
      windows.push({ startMin: DAY_START_MIN, endMin: DAY_END_MIN });
      continue;
    }
    // Missing clocks → conservative full-day block for assigned vehicle
    if (win.inferred && !job.startTime && !job.endTime) {
      windows.push({ startMin: DAY_START_MIN, endMin: DAY_END_MIN });
    } else {
      windows.push({ startMin: win.startMin, endMin: win.endMin });
    }
  }
  return windows.sort((a, b) => a.startMin - b.startMin);
}

/** True when vehicle has any free gap in the operational day window. */
export function vehicleHasFreeCapacityOnDate(
  vehicleId: string,
  jobs: Booking[],
  date: string,
): boolean {
  const windows = vehicleBusyWindows(vehicleId, jobs, date);
  if (!windows.length) return true;
  let cursor = DAY_START_MIN;
  for (const win of windows) {
    if (win.startMin > cursor + 15) return true; // ≥15 min free gap
    cursor = Math.max(cursor, win.endMin);
  }
  return cursor < DAY_END_MIN - 15;
}

export type DayAvailability = {
  status: DayAvailabilityStatus;
  label: string;
  jobCount: number;
  usableVehicleCount: number;
  freeVehicleCount: number;
  unassignedJobCount: number;
  summaryLine: string;
};

export function deriveDayAvailability(opts: {
  date: string;
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers?: Driver[];
  /** When set, capacity is for that single vehicle. */
  vehicleId?: string | null;
  /** When set without vehicleId, treat driver as single-resource schedule. */
  driverId?: string | null;
}): DayAvailability {
  const jobs = capacityJobsOnDate(opts.bookings, opts.date);
  const unassignedJobCount = jobs.filter((item) => !item.assignedVehicleId).length;

  let pool = usableFleetVehicles(opts.vehicles);
  if (opts.vehicleId) {
    pool = pool.filter((item) => item.id === opts.vehicleId);
  }

  // Driver-only filter: use driver assignment as resource truth
  if (opts.driverId && !opts.vehicleId) {
    const driverJobs = jobs.filter((item) => item.assignedDriverId === opts.driverId);
    const free =
      driverJobs.length === 0 ||
      driverJobs.every((job) => {
        const win = bookingWindowOnDate(job, opts.date);
        if (!win) return false;
        return win.endMin < DAY_END_MIN - 15 || win.startMin > DAY_START_MIN + 15;
      });
    // Rough: if any job spans inferred full day → busy
    const fullDay = driverJobs.some((job) => {
      const win = bookingWindowOnDate(job, opts.date);
      return !win || (win.startMin <= DAY_START_MIN && win.endMin >= DAY_END_MIN - 30);
    });
    if (driverJobs.length === 0) {
      return pack("AVAILABLE", 0, 1, 1, 0);
    }
    if (fullDay || !free) {
      return pack("FULL", driverJobs.length, 1, 0, 0);
    }
    return pack("BOOKED_AVAILABLE", driverJobs.length, 1, 1, 0);
  }

  if (pool.length === 0) {
    // No usable vehicles in current filter — cannot claim empty day is available
    if (jobs.length === 0) {
      return pack("UNKNOWN", 0, 0, 0, 0);
    }
    return pack("UNKNOWN", jobs.length, 0, 0, unassignedJobCount);
  }

  const freeVehicleCount = pool.filter((vehicle) =>
    vehicleHasFreeCapacityOnDate(vehicle.id, jobs, opts.date),
  ).length;

  const jobCount = jobs.length;

  if (jobCount === 0 && freeVehicleCount === pool.length) {
    return pack("AVAILABLE", 0, pool.length, freeVehicleCount, 0);
  }

  if (freeVehicleCount === 0) {
    // Only FULL when we know every usable vehicle has no remaining gap
    return pack("FULL", jobCount, pool.length, 0, unassignedJobCount);
  }

  if (freeVehicleCount <= NEAR_CAPACITY_REMAINING) {
    return pack("NEAR_CAPACITY", jobCount, pool.length, freeVehicleCount, unassignedJobCount);
  }

  if (jobCount > 0) {
    return pack("BOOKED_AVAILABLE", jobCount, pool.length, freeVehicleCount, unassignedJobCount);
  }

  return pack("AVAILABLE", 0, pool.length, freeVehicleCount, unassignedJobCount);
}

function pack(
  status: DayAvailabilityStatus,
  jobCount: number,
  usableVehicleCount: number,
  freeVehicleCount: number,
  unassignedJobCount: number,
): DayAvailability {
  const label = DAY_AVAILABILITY_LABELS[status];
  let summaryLine = "";
  if (status === "AVAILABLE") {
    summaryLine = `${jobCount} งาน`;
  } else if (status === "FULL") {
    summaryLine =
      freeVehicleCount === 0 && usableVehicleCount > 0
        ? `${jobCount} งาน · ไม่มีรถว่าง`
        : `${jobCount} งาน`;
  } else if (status === "UNKNOWN") {
    summaryLine = jobCount ? `${jobCount} งาน · ประเมินไม่ได้` : "ประเมินไม่ได้";
  } else {
    summaryLine = `${jobCount} งาน · เหลือ ${freeVehicleCount} คัน`;
  }
  if (unassignedJobCount > 0 && status !== "AVAILABLE") {
    summaryLine += ` · ยังไม่จัดรถ ${unassignedJobCount}`;
  }
  return {
    status,
    label,
    jobCount,
    usableVehicleCount,
    freeVehicleCount,
    unassignedJobCount,
    summaryLine,
  };
}

export const DAY_AVAILABILITY_DOT_CLASS: Record<DayAvailabilityStatus, string> = {
  AVAILABLE: "bg-success",
  BOOKED_AVAILABLE: "bg-amber-400",
  NEAR_CAPACITY: "bg-orange-500",
  FULL: "bg-danger",
  UNKNOWN: "bg-muted",
};

export const DAY_AVAILABILITY_TINT_CLASS: Record<DayAvailabilityStatus, string> = {
  AVAILABLE: "bg-success/[0.04]",
  BOOKED_AVAILABLE: "bg-amber-400/[0.06]",
  NEAR_CAPACITY: "bg-orange-500/[0.07]",
  FULL: "bg-danger/[0.06]",
  UNKNOWN: "",
};
