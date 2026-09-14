import { isBlockingStatus } from "./booking-rules";
import type { Booking } from "./types";

export type DateRange = {
  startDate: string;
  endDate: string | null;
};

export function bookingRange(booking: DateRange): { start: string; end: string } {
  return {
    start: booking.startDate,
    end: booking.endDate ?? booking.startDate,
  };
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  const left = bookingRange(a);
  const right = bookingRange(b);
  return left.start <= right.end && right.start <= left.end;
}

const SOFT_STATUSES = new Set(["CUSTOMER_CONFIRMED", "WAITING_DEPOSIT"]);

function matchOverlaps(
  bookings: Booking[],
  range: DateRange,
  ignoreBookingId: string | undefined,
  predicate: (booking: Booking) => boolean,
) {
  return bookings.find(
    (booking) =>
      booking.id !== ignoreBookingId &&
      predicate(booking) &&
      rangesOverlap(booking, range),
  ) ?? null;
}

export function findAssignmentConflict(input: {
  bookings: Booking[];
  vehicleId?: string | null;
  driverId?: string | null;
  range: DateRange;
  ignoreBookingId?: string;
}): { vehicle: Booking | null; driver: Booking | null } {
  const blocking = input.bookings.filter(
    (booking) =>
      booking.id !== input.ignoreBookingId &&
      isBlockingStatus(booking.status) &&
      rangesOverlap(booking, input.range),
  );

  return {
    vehicle: input.vehicleId
      ? blocking.find((booking) => booking.assignedVehicleId === input.vehicleId) ??
        null
      : null,
    driver: input.driverId
      ? blocking.find((booking) => booking.assignedDriverId === input.driverId) ??
        null
      : null,
  };
}

export function findAssignmentWarning(input: {
  bookings: Booking[];
  vehicleId?: string | null;
  driverId?: string | null;
  range: DateRange;
  ignoreBookingId?: string;
}): { vehicle: Booking | null; driver: Booking | null } {
  return {
    vehicle: input.vehicleId
      ? matchOverlaps(
          input.bookings,
          input.range,
          input.ignoreBookingId,
          (booking) =>
            SOFT_STATUSES.has(booking.status) &&
            booking.assignedVehicleId === input.vehicleId,
        )
      : null,
    driver: input.driverId
      ? matchOverlaps(
          input.bookings,
          input.range,
          input.ignoreBookingId,
          (booking) =>
            SOFT_STATUSES.has(booking.status) &&
            booking.assignedDriverId === input.driverId,
        )
      : null,
  };
}
