"use client";

import Link from "next/link";
import { formatDuration, jobsOnDate } from "@/lib/domain/fleet";
import {
  DAY_AVAILABILITY_DOT_CLASS,
  deriveDayAvailability,
} from "@/lib/domain/day-availability";
import { formatThaiDate } from "@/lib/domain/ops";
import { statusLabel } from "@/lib/domain/status-ui";
import {
  TRIP_PROGRESS_LABEL,
  deriveTripProgressFromBooking,
} from "@/lib/domain/location";
import type { Booking, Driver, Vehicle } from "@/lib/domain/types";
import { SERVICE_TYPE_LABELS } from "@/lib/domain/enums";

export function DayJobsDrawer({
  date,
  bookings,
  vehicles,
  drivers,
  onClose,
  onOpenBooking,
  vehicleFilter = "",
  driverFilter = "",
}: {
  date: string;
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  onClose: () => void;
  onOpenBooking: (id: string) => void;
  vehicleFilter?: string;
  driverFilter?: string;
}) {
  const jobs = jobsOnDate(bookings, date);
  const availability = deriveDayAvailability({
    date,
    bookings,
    vehicles,
    vehicleId: vehicleFilter || null,
    driverId: driverFilter || null,
  });

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-navy-950/35" onClick={onClose} aria-label="ปิด" />
      <aside className="kh-drawer absolute inset-x-0 bottom-0 flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:max-w-md md:rounded-none">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs text-muted">ตารางเดินรถ</p>
            <h2 className="text-lg font-semibold text-navy-800">{formatThaiDate(date)}</h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-navy-800">
              <span
                className={`inline-block h-2 w-2 rounded-full ${DAY_AVAILABILITY_DOT_CLASS[availability.status]}`}
              />
              <span className="font-medium">{availability.label}</span>
              <span className="text-muted">{availability.summaryLine}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            ปิด
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {jobs.length === 0 ? (
            <p className="rounded-2xl bg-paper px-4 py-6 text-center text-sm text-muted">ไม่มีงานในวันนี้</p>
          ) : null}
          {jobs.map((booking) => {
            const vehicle = vehicles.find((item) => item.id === booking.assignedVehicleId);
            const driver = drivers.find((item) => item.id === booking.assignedDriverId);
            return (
              <button
                key={booking.id}
                type="button"
                onClick={() => onOpenBooking(booking.id)}
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-left transition hover:border-accent/50 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-navy-800">
                    {booking.startTime ?? "ทั้งวัน"} · {statusLabel(booking.status)}
                  </p>
                  {["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status) ? (
                    <span className="text-[11px] text-navy-800">
                      {TRIP_PROGRESS_LABEL[deriveTripProgressFromBooking(booking)]}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-medium text-navy-800">
                  {SERVICE_TYPE_LABELS[booking.serviceType] ?? booking.serviceType}
                </p>
                <p className="mt-1 text-sm">
                  {booking.pickupLocation}
                  {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {vehicle ? `${vehicle.brand} ${vehicle.model}` : "ยังไม่ได้จัดรถ"}
                  {" · "}
                  คนขับ: {driver?.name ?? "—"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {booking.bookingCode} · {formatDuration(booking)}
                </p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 border-t border-line p-4 sm:grid-cols-2">
          <Link
            href={`/store/bookings?date=${date}`}
            className="h-11 rounded-xl bg-navy-800 text-center text-sm leading-[2.75rem] text-white"
          >
            ดูรายการทั้งหมดของวันนี้
          </Link>
          <Link
            href={`/store/bookings?date=${date}`}
            className="h-11 rounded-xl bg-paper text-center text-sm leading-[2.75rem] text-navy-800"
          >
            + เพิ่มงานในวันนี้
          </Link>
        </div>
      </aside>
    </div>
  );
}

export function DayJobChip({
  booking,
  vehicle,
  onOpen,
}: {
  booking: Booking;
  vehicle?: Vehicle | null;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(booking.id);
      }}
      className="block w-full truncate rounded-md bg-navy-800/8 px-1.5 py-0.5 text-left text-[10px] font-medium text-navy-800"
    >
      {booking.startTime ?? "—"} {vehicle?.model ?? "ยังไม่จัดรถ"}
    </button>
  );
}
