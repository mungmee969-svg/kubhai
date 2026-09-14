"use client";

import { useState } from "react";
import { ResourceStateBadge } from "@/components/store-admin/ui/ResourceStateBadge";
import { formatThaiDate, nextJobFor, resourceState, type ResourceState } from "@/lib/domain/ops";
import type { Booking, Driver, Vehicle } from "@/lib/domain/types";

export function AssignDrawer({
  open,
  kind,
  booking,
  bookings,
  vehicles,
  drivers,
  pending,
  onClose,
  onAssign,
  onDispatch,
}: {
  open: boolean;
  kind: "vehicle" | "driver" | "dispatch";
  booking: Booking;
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  pending: boolean;
  onClose: () => void;
  onAssign?: (id: string | null) => void;
  onDispatch?: (vehicleId: string | null, driverId: string | null) => void;
}) {
  if (!open) return null;
  return (
    <AssignDrawerBody
      key={`${booking.id}-${booking.assignedVehicleId}-${booking.assignedDriverId}-${kind}`}
      kind={kind}
      booking={booking}
      bookings={bookings}
      vehicles={vehicles}
      drivers={drivers}
      pending={pending}
      onClose={onClose}
      onAssign={onAssign}
      onDispatch={onDispatch}
    />
  );
}

function AssignDrawerBody({
  kind,
  booking,
  bookings,
  vehicles,
  drivers,
  pending,
  onClose,
  onAssign,
  onDispatch,
}: {
  kind: "vehicle" | "driver" | "dispatch";
  booking: Booking;
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  pending: boolean;
  onClose: () => void;
  onAssign?: (id: string | null) => void;
  onDispatch?: (vehicleId: string | null, driverId: string | null) => void;
}) {
  const [vehicleId, setVehicleId] = useState<string | null>(booking.assignedVehicleId);
  const [driverId, setDriverId] = useState<string | null>(booking.assignedDriverId);
  const range = { startDate: booking.startDate, endDate: booking.endDate };
  const ownVehicles = vehicles.filter((item) => item.ownershipType === "OWN");
  const partnerVehicles = vehicles.filter((item) => item.ownershipType === "PARTNER");
  const ownDrivers = drivers.filter((item) => item.driverType === "INTERNAL");
  const partnerDrivers = drivers.filter((item) => item.driverType === "PARTNER");
  const title =
    kind === "dispatch" ? "จัดรถและคนขับ" : kind === "vehicle" ? "กำหนดรถ" : "กำหนดคนขับ";

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-navy-950/40" onClick={onClose} aria-label="ปิด" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl sm:max-w-lg">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold text-[color:var(--store-primary,#0F3D3E)]">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-muted">
            ปิด
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-28">
          {kind === "vehicle" || kind === "dispatch" ? (
            <Section title="รถ">
              {[...ownVehicles, ...partnerVehicles].map((vehicle) => (
                <VehicleRow
                  key={vehicle.id}
                  vehicle={vehicle}
                  booking={booking}
                  bookings={bookings}
                  range={range}
                  pending={pending}
                  selected={
                    kind === "dispatch" ? vehicleId === vehicle.id : booking.assignedVehicleId === vehicle.id
                  }
                  onSelect={() => {
                    if (kind === "dispatch") setVehicleId(vehicle.id);
                    else onAssign?.(vehicle.id);
                  }}
                />
              ))}
              {vehicles.length === 0 ? <p className="text-sm text-muted">ยังไม่มีรถ</p> : null}
            </Section>
          ) : null}

          {kind === "driver" || kind === "dispatch" ? (
            <Section title="คนขับ">
              {[...ownDrivers, ...partnerDrivers].map((driver) => (
                <DriverRow
                  key={driver.id}
                  driver={driver}
                  booking={booking}
                  bookings={bookings}
                  range={range}
                  pending={pending}
                  selected={
                    kind === "dispatch" ? driverId === driver.id : booking.assignedDriverId === driver.id
                  }
                  onSelect={() => {
                    if (kind === "dispatch") setDriverId(driver.id);
                    else onAssign?.(driver.id);
                  }}
                />
              ))}
              {drivers.length === 0 ? <p className="text-sm text-muted">ยังไม่มีคนขับ</p> : null}
            </Section>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t border-line bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {kind === "dispatch" ? (
            <button
              type="button"
              disabled={pending || !vehicleId || !driverId}
              onClick={() => onDispatch?.(vehicleId, driverId)}
              className="h-12 w-full rounded-xl bg-[color:var(--store-accent,#C4A35A)] text-sm font-semibold text-navy-950 disabled:opacity-50"
            >
              {pending ? "กำลังบันทึก..." : "ยืนยันรถและคนขับ"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => onAssign?.(null)}
              className="h-11 w-full rounded-xl bg-paper text-sm disabled:opacity-60"
            >
              ยกเลิกการมอบหมาย
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-navy-800">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function VehicleRow({
  vehicle,
  booking,
  bookings,
  range,
  pending,
  selected,
  onSelect,
}: {
  vehicle: Vehicle;
  booking: Booking;
  bookings: Booking[];
  range: { startDate: string; endDate: string | null };
  pending: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const state = resourceState({
    active: vehicle.active,
    unavailable: vehicle.status !== "ACTIVE",
    bookings,
    resourceId: vehicle.id,
    kind: "vehicle",
    range,
    ignoreBookingId: booking.id,
  });
  const next = nextJobFor(bookings, vehicle.id, "vehicle", booking.startDate);
  const blocked = state === "BUSY" || state === "UNAVAILABLE";
  return (
    <button
      type="button"
      disabled={pending || blocked}
      onClick={onSelect}
      className={`w-full rounded-2xl border px-3 py-3 text-left disabled:opacity-40 ${
        selected
          ? "border-[color:var(--store-primary,#0F3D3E)] bg-[color:var(--store-primary,#0F3D3E)]/5"
          : "border-line"
      }`}
    >
      <div className="flex gap-3">
        {vehicle.imageUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vehicle.imageUrls[0]} alt="" className="h-16 w-24 rounded-xl object-cover" />
        ) : (
          <div className="h-16 w-24 rounded-xl bg-paper" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy-800">
            {vehicle.brand} {vehicle.model}
          </p>
          <p className="text-xs text-muted">
            {vehicle.plateNumber ?? "ไม่มีทะเบียน"} · {vehicle.seats} ที่นั่ง · {vehicle.ownershipType}
          </p>
          <div className="mt-1">
            <ResourceStateBadge state={state} />
          </div>
          {next ? (
            <p className="mt-1 text-xs text-muted">
              งานถัดไป {next.bookingCode} · {formatThaiDate(next.startDate)} {next.startTime ?? ""}
            </p>
          ) : null}
          {state === "BUSY" ? (
            <p className="mt-1 text-xs text-danger">มีงานที่ยืนยันแล้วชนช่วงนี้</p>
          ) : null}
          {state === "SOFT" ? (
            <p className="mt-1 text-xs text-accent-deep">มีงานรอยืนยันทับช่วง — เลือกได้แต่ควรตรวจ</p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function DriverRow({
  driver,
  booking,
  bookings,
  range,
  pending,
  selected,
  onSelect,
}: {
  driver: Driver;
  booking: Booking;
  bookings: Booking[];
  range: { startDate: string; endDate: string | null };
  pending: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const state: ResourceState = resourceState({
    active: driver.active,
    unavailable: driver.status !== "ACTIVE",
    bookings,
    resourceId: driver.id,
    kind: "driver",
    range,
    ignoreBookingId: booking.id,
  });
  const next = nextJobFor(bookings, driver.id, "driver", booking.startDate);
  const blocked = state === "BUSY" || state === "UNAVAILABLE";
  return (
    <button
      type="button"
      disabled={pending || blocked}
      onClick={onSelect}
      className={`w-full rounded-2xl border px-3 py-3 text-left disabled:opacity-40 ${
        selected
          ? "border-[color:var(--store-primary,#0F3D3E)] bg-[color:var(--store-primary,#0F3D3E)]/5"
          : "border-line"
      }`}
    >
      <div className="flex gap-3">
        {driver.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={driver.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-paper" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy-800">{driver.name}</p>
          <p className="text-xs text-muted">
            {driver.phone ?? "ไม่มีเบอร์"} · {driver.driverType}
          </p>
          <div className="mt-1">
            <ResourceStateBadge state={state} />
          </div>
          {next ? (
            <p className="mt-1 text-xs text-muted">
              งานถัดไป {next.bookingCode} · {formatThaiDate(next.startDate)}
            </p>
          ) : null}
          {state === "BUSY" ? (
            <p className="mt-1 text-xs text-danger">มีงานที่ยืนยันแล้วชนช่วงนี้</p>
          ) : null}
        </div>
      </div>
    </button>
  );
}
