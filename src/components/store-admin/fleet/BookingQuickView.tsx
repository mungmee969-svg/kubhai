"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AssignDrawer } from "@/components/store-admin/booking/AssignDrawer";
import { DriverAvatar } from "@/components/store-admin/fleet/DriverAvatar";
import { VehiclePhoto } from "@/components/store-admin/fleet/VehiclePhoto";
import { assignBookingAction } from "@/lib/actions/store";
import { formatDuration } from "@/lib/domain/fleet";
import { formatMoney, formatThaiDate } from "@/lib/domain/ops";
import type { Booking, Driver, Vehicle } from "@/lib/domain/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function BookingQuickView({
  booking,
  vehicle,
  driver,
  vehicles,
  drivers,
  bookings,
  onClose,
}: {
  booking: Booking;
  vehicle?: Vehicle;
  driver?: Driver;
  vehicles: Vehicle[];
  drivers: Driver[];
  bookings: Booking[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<"vehicle" | "driver" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(patch: { vehicleId?: string | null; driverId?: string | null }) {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await assignBookingAction(booking.id, patch);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDrawer(null);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-navy-950/35" onClick={onClose} />
      <aside className="kh-drawer absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs text-muted">{formatThaiDate(booking.startDate)}</p>
            <h2 className="text-lg font-semibold text-navy-800">{booking.bookingCode}</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={booking.status} />
            <button type="button" onClick={onClose} className="text-sm text-muted">
              ปิด
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <p className="font-medium text-navy-800">{booking.customerNameSnapshot}</p>
          <p className="text-muted">{booking.customerPhoneSnapshot}</p>
          <p>
            {booking.pickupLocation}
            {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
          </p>
          <p className="text-muted">
            {formatThaiDate(booking.startDate)}
            {booking.endDate && booking.endDate !== booking.startDate ? ` → ${formatThaiDate(booking.endDate)}` : ""}{" "}
            {booking.startTime ?? "ทั้งวัน"}
            {booking.endTime ? `–${booking.endTime}` : ""} · {formatDuration(booking)}
            {booking.passengerCount ? ` · ${booking.passengerCount} คน` : ""}
          </p>
          {booking.tripNotes ? (
            <div>
              <p className="text-xs text-muted">แผนเที่ยว</p>
              <p>{booking.tripNotes}</p>
            </div>
          ) : (
            <p className="text-xs text-muted">ยังไม่มีแผนเที่ยวเพิ่มเติม</p>
          )}
          {vehicle ? (
            <div className="flex gap-3 rounded-2xl bg-paper p-3">
              <div className="h-14 w-20 overflow-hidden rounded-xl">
                <VehiclePhoto vehicle={vehicle} />
              </div>
              <div>
                <p className="font-medium">
                  {vehicle.brand} {vehicle.model}
                </p>
                <p className="text-xs text-muted">{vehicle.plateNumber}</p>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl bg-accent/15 px-3 py-2 text-navy-800">ยังไม่ได้จัดรถ</p>
          )}
          <div className="flex items-center gap-2">
            <DriverAvatar driver={driver} size="md" />
            <span>{driver ? driver.name : "ยังไม่มีคนขับ"}</span>
          </div>
          <p>ยอด {formatMoney(booking.quotedTotal)}</p>
          {error ? <p className="text-danger">{error}</p> : null}
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-line p-4">
          <Link href={`/store/bookings/${booking.id}`} className="h-10 rounded-xl bg-navy-800 text-center text-xs leading-10 text-white">
            เปิดงานเต็ม
          </Link>
          <button type="button" onClick={() => setDrawer("vehicle")} className="h-10 rounded-xl bg-paper text-xs">
            เปลี่ยนรถ
          </button>
          <button type="button" onClick={() => setDrawer("driver")} className="h-10 rounded-xl bg-paper text-xs">
            เปลี่ยนคนขับ
          </button>
        </div>
      </aside>
      <AssignDrawer
        open={drawer === "vehicle"}
        kind="vehicle"
        booking={booking}
        bookings={bookings}
        vehicles={vehicles}
        drivers={drivers}
        pending={pending}
        onClose={() => setDrawer(null)}
        onAssign={(vehicleId) => void assign({ vehicleId, driverId: booking.assignedDriverId })}
      />
      <AssignDrawer
        open={drawer === "driver"}
        kind="driver"
        booking={booking}
        bookings={bookings}
        vehicles={vehicles}
        drivers={drivers}
        pending={pending}
        onClose={() => setDrawer(null)}
        onAssign={(driverId) => void assign({ vehicleId: booking.assignedVehicleId, driverId })}
      />
    </div>
  );
}
