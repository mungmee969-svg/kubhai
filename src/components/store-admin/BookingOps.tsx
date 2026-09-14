"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignBookingAction, updateBookingStatusAction } from "@/lib/actions/store";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/domain/enums";
import { canTransition } from "@/lib/domain/booking-rules";
import type { Booking, Driver, Vehicle } from "@/lib/domain/types";

const NEXT: BookingStatus[] = [
  "CHECKING_AVAILABILITY",
  "AVAILABLE",
  "QUOTATION_SENT",
  "CUSTOMER_CONFIRMED",
  "WAITING_DEPOSIT",
  "CONFIRMED",
  "IN_PROGRESS",
  "CANCELLED",
  "REJECTED",
];

export function BookingOps({
  booking,
  vehicles,
  drivers,
}: {
  booking: Booking;
  vehicles: Vehicle[];
  drivers: Driver[];
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(booking.assignedVehicleId ?? "");
  const [driverId, setDriverId] = useState(booking.assignedDriverId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function assign() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await assignBookingAction(booking.id, {
      vehicleId: vehicleId || null,
      driverId: driverId || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function changeStatus(status: BookingStatus) {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await updateBookingStatusAction(booking.id, status);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">มอบหมายรถ / คนขับ</h2>
        <div className="mt-3 grid gap-3">
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="input bg-paper"
          >
            <option value="">ยังไม่ระบุรถ</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.brand} {vehicle.model} · {vehicle.ownershipType}
              </option>
            ))}
          </select>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="input bg-paper"
          >
            <option value="">ยังไม่ระบุคนขับ</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name} · {driver.driverType}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={assign}
            disabled={pending}
            className="h-12 rounded-2xl bg-navy-800 text-white font-semibold disabled:opacity-60"
          >
            {pending ? "กำลังบันทึก..." : "บันทึกการมอบหมาย"}
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">อัปเดตสถานะ</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {NEXT.filter((status) => canTransition(booking.status, status)).map(
            (status) => (
              <button
                key={status}
                type="button"
                disabled={pending}
                onClick={() => changeStatus(status)}
                className="rounded-full bg-paper px-3 py-2 text-xs font-medium disabled:opacity-60"
              >
                {BOOKING_STATUS_LABELS[status]}
              </button>
            ),
          )}
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}
