"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { assignBookingAction, updateBookingStatusAction } from "@/lib/actions/store";
import {
  addNoteAction,
  deleteItineraryAction,
  saveItineraryAction,
  updateTripAction,
} from "@/lib/actions/ops";
import { BOOKING_STATUS_LABELS, SERVICE_TYPE_LABELS, type BookingStatus } from "@/lib/domain/enums";
import { canTransition } from "@/lib/domain/booking-rules";
import { findAssignmentConflict, findAssignmentWarning } from "@/lib/domain/availability";
import type { BookingRecord } from "@/lib/data/repository";
import type { Driver, Place, Vehicle } from "@/lib/domain/types";

const TIMELINE: BookingStatus[] = [
  "REQUESTED",
  "CHECKING_AVAILABILITY",
  "AVAILABLE",
  "QUOTATION_SENT",
  "CUSTOMER_CONFIRMED",
  "WAITING_DEPOSIT",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
];

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

export function BookingDetail({
  record,
  vehicles,
  drivers,
  places,
  bookings,
}: {
  record: BookingRecord;
  vehicles: Vehicle[];
  drivers: Driver[];
  places: Place[];
  bookings: BookingRecord["booking"][];
}) {
  const router = useRouter();
  const booking = record.booking;
  const [vehicleId, setVehicleId] = useState(booking.assignedVehicleId ?? "");
  const [driverId, setDriverId] = useState(booking.assignedDriverId ?? "");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [driverQuery, setDriverQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickup, setPickup] = useState(booking.pickupLocation);
  const [dropoff, setDropoff] = useState(booking.dropoffLocation ?? "");
  const [startDate, setStartDate] = useState(booking.startDate);
  const [startTime, setStartTime] = useState(booking.startTime ?? "");
  const [note, setNote] = useState("");
  const [stopTitle, setStopTitle] = useState("");
  const [placeId, setPlaceId] = useState("");

  const vehicleChoices = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    return vehicles
      .filter((item) => item.active)
      .filter((item) =>
        q
          ? `${item.brand} ${item.model} ${item.ownershipType}`.toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => a.ownershipType.localeCompare(b.ownershipType));
  }, [vehicles, vehicleQuery]);

  const driverChoices = useMemo(() => {
    const q = driverQuery.trim().toLowerCase();
    return drivers
      .filter((item) => item.active)
      .filter((item) =>
        q ? `${item.name} ${item.driverType}`.toLowerCase().includes(q) : true,
      );
  }, [drivers, driverQuery]);

  const preview = findAssignmentConflict({
    bookings,
    vehicleId: vehicleId || null,
    driverId: driverId || null,
    range: { startDate, endDate: booking.endDate },
    ignoreBookingId: booking.id,
  });
  const warning = findAssignmentWarning({
    bookings,
    vehicleId: vehicleId || null,
    driverId: driverId || null,
    range: { startDate, endDate: booking.endDate },
    ignoreBookingId: booking.id,
  });

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{record.business.name}</p>
          <h1 className="text-2xl font-semibold text-navy-800">{booking.bookingCode}</h1>
          <p className="mt-1 text-xs text-muted">สร้าง {booking.createdAt.slice(0, 16).replace("T", " ")}</p>
        </div>
        <StatusBadge status={booking.status} />
      </header>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">ลูกค้า</h2>
        <p className="mt-2 text-sm">{booking.customerNameSnapshot}</p>
        <p className="text-sm text-muted">{booking.customerPhoneSnapshot}</p>
        {booking.customerEmailSnapshot ? (
          <p className="text-sm text-muted">{booking.customerEmailSnapshot}</p>
        ) : null}
        {record.customer ? (
          <p className="mt-2 text-xs text-muted">ลูกค้าในระบบ · {record.customer.id.slice(0, 8)}</p>
        ) : null}
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">ทริป</h2>
        <p className="mt-1 text-sm text-muted">{SERVICE_TYPE_LABELS[booking.serviceType]}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input className="input bg-paper" value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" />
          <input className="input bg-paper" value={startTime} onChange={(e) => setStartTime(e.target.value)} type="time" />
          <input className="input bg-paper" value={pickup} onChange={(e) => setPickup(e.target.value)} />
          <input className="input bg-paper" value={dropoff} onChange={(e) => setDropoff(e.target.value)} />
        </div>
        <p className="mt-2 text-sm text-muted">ผู้โดยสาร {booking.passengerCount} คน</p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              updateTripAction(booking.id, {
                startDate,
                startTime: startTime || null,
                pickupLocation: pickup,
                dropoffLocation: dropoff || null,
              }),
            )
          }
          className="mt-3 h-11 rounded-2xl bg-navy-800 px-4 text-white text-sm font-semibold disabled:opacity-60"
        >
          บันทึกทริป
        </button>
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">รถที่ลูกค้าขอ</h2>
        <p className="mt-2 text-sm text-muted">
          {record.preferredVehicle
            ? `${record.preferredVehicle.brand} ${record.preferredVehicle.model}`
            : "ให้ร้านแนะนำ"}
        </p>
      </section>

      <section id="assign" className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">กำหนดรถ / คนขับ</h2>
        <p className="mt-1 text-sm text-muted">ตรวจรถร้าน (OWN) ก่อน ถ้าไม่ว่างใช้รถพาร์ทเนอร์ได้</p>
        <input
          className="input mt-3 bg-paper"
          placeholder="ค้นหารถ"
          value={vehicleQuery}
          onChange={(e) => setVehicleQuery(e.target.value)}
        />
        <select className="input mt-2 bg-paper" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">ยังไม่ระบุรถ</option>
          {vehicleChoices.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.ownershipType} · {vehicle.brand} {vehicle.model} · {vehicle.seats} ที่นั่ง
            </option>
          ))}
        </select>
        <input
          className="input mt-3 bg-paper"
          placeholder="ค้นหาคนขับ"
          value={driverQuery}
          onChange={(e) => setDriverQuery(e.target.value)}
        />
        <select className="input mt-2 bg-paper" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
          <option value="">ยังไม่ระบุคนขับ</option>
          {driverChoices.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.driverType} · {driver.name}
            </option>
          ))}
        </select>
        {preview.vehicle || preview.driver ? (
          <p className="mt-3 text-sm text-danger">
            {preview.vehicle ? "รถคันนี้มีงานที่ยืนยันแล้วทับช่วงวันเดียวกัน" : ""}
            {preview.driver ? " คนขับคนนี้มีงานที่ยืนยันแล้วทับช่วงวันเดียวกัน" : ""}
          </p>
        ) : null}
        {warning.vehicle || warning.driver ? (
          <p className="mt-2 text-sm text-accent-deep">
            มีงานที่รอยืนยัน/รอมัดจำทับช่วงวัน — ยังกำหนดได้ แต่ควรตรวจสอบ
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              assignBookingAction(booking.id, {
                vehicleId: vehicleId || null,
                driverId: driverId || null,
              }),
            )
          }
          className="mt-3 h-11 rounded-2xl bg-accent px-4 text-navy-950 text-sm font-semibold disabled:opacity-60"
        >
          บันทึกการมอบหมาย
        </button>
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">แผนทริป</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {record.itinerary.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2">
              <span>
                {item.dayNumber ? `วันที่ ${item.dayNumber} · ` : ""}
                {item.title}
                {item.location ? ` · ${item.location}` : ""}
              </span>
              <button
                type="button"
                className="text-xs text-danger"
                onClick={() => run(() => deleteItineraryAction(item.id, booking.id))}
              >
                ลบ
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2">
          <select className="input bg-paper" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            <option value="">เลือกจากสถานที่ร้าน</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
          <input
            className="input bg-paper"
            placeholder="หรือพิมพ์ชื่อจุด"
            value={stopTitle}
            onChange={(e) => setStopTitle(e.target.value)}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const place = places.find((item) => item.id === placeId);
              return run(() =>
                saveItineraryAction(booking.id, {
                  title: stopTitle || place?.name || "",
                  location: place?.address ?? null,
                  dayNumber: 1,
                  estimatedMinutes: place?.estimatedDurationMinutes ?? null,
                  note: null,
                  placeId: place?.id ?? null,
                }),
              );
            }}
            className="h-11 rounded-2xl bg-navy-800 text-white text-sm font-semibold disabled:opacity-60"
          >
            เพิ่มจุดในทริป
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-5">
          <h2 className="font-semibold">ราคา</h2>
          <p className="mt-2 text-sm text-muted">ใบเสนอราคายังไม่เปิดในรอบนี้</p>
        </div>
        <div className="rounded-3xl bg-white p-5">
          <h2 className="font-semibold">การชำระเงิน</h2>
          <p className="mt-2 text-sm text-muted">มัดจำ / สลิปยังไม่เปิดในรอบนี้</p>
        </div>
      </section>

      <section id="status" className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">สถานะ</h2>
        <p className="mt-1 text-sm text-muted">{BOOKING_STATUS_LABELS[booking.status]}</p>
        <ol className="mt-3 space-y-1 text-xs">
          {TIMELINE.map((status) => (
            <li
              key={status}
              className={status === booking.status ? "font-semibold text-navy-800" : "text-muted"}
            >
              {status === booking.status ? "● " : "○ "}
              {BOOKING_STATUS_LABELS[status]}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          {NEXT.filter((status) => canTransition(booking.status, status)).map((status) => (
            <button
              key={status}
              type="button"
              disabled={pending}
              onClick={() => run(() => updateBookingStatusAction(booking.id, status))}
              className="rounded-full bg-paper px-3 py-2 text-xs font-medium disabled:opacity-60"
            >
              {BOOKING_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">โน้ตภายใน</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {record.notes.map((item) => (
            <li key={item.id} className="rounded-2xl bg-paper px-3 py-2">
              {item.body}
              <span className="mt-1 block text-xs text-muted">{item.createdAt.slice(0, 16)}</span>
            </li>
          ))}
        </ul>
        <textarea className="input mt-3 min-h-24 bg-paper py-3" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await addNoteAction(booking.id, note);
              if (result.ok) setNote("");
              return result;
            })
          }
          className="mt-2 h-11 rounded-2xl bg-navy-800 px-4 text-white text-sm font-semibold disabled:opacity-60"
        >
          เพิ่มโน้ต
        </button>
      </section>

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">ประวัติการแก้ไข</h2>
        <ul className="mt-3 space-y-2 text-xs text-muted">
          {record.auditLogs.map((item) => (
            <li key={item.id}>
              {item.createdAt.slice(0, 16).replace("T", " ")} · {item.action}
            </li>
          ))}
        </ul>
      </section>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
