"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CancelBookingSheet } from "@/components/store-admin/booking/CancelBookingSheet";
import { assignBookingAction } from "@/lib/actions/store";
import { driverJobPath } from "@/lib/domain/driver-job";
import {
  OPS_JOB_FILTERS,
  OPS_JOB_STATUS_LABEL,
  driverLinkForBooking,
  matchesOpsJobFilter,
  resolveOpsJobStatus,
  sortOpsJobs,
  type OpsJobFilter,
} from "@/lib/domain/dispatch-ops";
import { formatThaiDate } from "@/lib/domain/ops";
import type { Booking, Driver, DriverDayWorkLog, DriverJobLink, Vehicle } from "@/lib/domain/types";

export function DispatchOpsJobList({
  bookings,
  vehicles,
  drivers,
  dayLogs,
  driverLinks,
  selectedDate,
  onOpen,
}: {
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  dayLogs: DriverDayWorkLog[];
  driverLinks: DriverJobLink[];
  selectedDate: string | null;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<OpsJobFilter>("ALL");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [pending, startTransition] = useTransition();
  const [copyFlash, setCopyFlash] = useState<string | null>(null);

  const rows = useMemo(() => {
    const filtered = bookings.filter((item) => matchesOpsJobFilter(item, dayLogs, filter));
    return sortOpsJobs(filtered);
  }, [bookings, dayLogs, filter]);

  async function copyDriverLink(token: string) {
    const url = `${window.location.origin}${driverJobPath(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyFlash(token);
      window.setTimeout(() => setCopyFlash(null), 1600);
    } catch {
      window.prompt("คัดลอกลิงก์คนขับ", url);
    }
  }

  function reassign(bookingId: string, kind: "vehicle" | "driver") {
    const id =
      kind === "vehicle"
        ? window.prompt("รหัสรถ (vehicle id) — ว่าง = ถอดรถ")
        : window.prompt("รหัสคนขับ (driver id) — ว่าง = ถอดคนขับ");
    if (id === null) return;
    startTransition(async () => {
      const result = await assignBookingAction(
        bookingId,
        kind === "vehicle"
          ? { vehicleId: id.trim() || null }
          : { driverId: id.trim() || null },
      );
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-navy-800">รายการงาน</h2>
          <p className="text-xs text-muted">
            {selectedDate
              ? `งานวันที่ ${formatThaiDate(selectedDate)}`
              : "ตามช่วงปฏิทินที่เลือก"}
            {" · "}
            {rows.length} งาน
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {OPS_JOB_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`ui-press rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === item.key
                  ? "bg-[color:var(--store-primary,#0F3D3E)] text-white"
                  : "bg-white text-navy-800 ring-1 ring-line"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-muted">
          ไม่มีงานในช่วงนี้
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">เวลา</th>
                  <th className="px-3 py-2 font-medium">Booking</th>
                  <th className="px-3 py-2 font-medium">ลูกค้า</th>
                  <th className="px-3 py-2 font-medium">เส้นทาง</th>
                  <th className="px-3 py-2 font-medium">รถ</th>
                  <th className="px-3 py-2 font-medium">คนขับ</th>
                  <th className="px-3 py-2 font-medium">สถานะ</th>
                  <th className="px-3 py-2 font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((booking) => {
                  const vehicle = vehicles.find((item) => item.id === booking.assignedVehicleId);
                  const driver = drivers.find((item) => item.id === booking.assignedDriverId);
                  const status = resolveOpsJobStatus(booking, dayLogs);
                  const link = driverLinkForBooking(driverLinks, booking.id);
                  return (
                    <tr key={booking.id} className="border-t border-line/80">
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium tabular-nums">
                        {booking.startTime ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{booking.bookingCode}</td>
                      <td className="px-3 py-2.5">{booking.customerNameSnapshot}</td>
                      <td className="max-w-[12rem] truncate px-3 py-2.5">
                        {booking.pickupLocation}
                        {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
                      </td>
                      <td className="px-3 py-2.5">
                        {vehicle ? `${vehicle.brand} ${vehicle.model}` : "ยังไม่ได้จัดรถ"}
                      </td>
                      <td className="px-3 py-2.5">
                        {driver ? driver.name : "ยังไม่ได้จัดคนขับ"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full bg-paper px-2 py-0.5 text-xs">
                          {OPS_JOB_STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="relative flex items-center gap-1.5">
                          <Link
                            href={`/store/bookings/${booking.id}`}
                            className="ui-press rounded-lg bg-[color:var(--store-accent,#C4A35A)] px-2.5 py-1.5 text-xs font-semibold text-navy-950"
                          >
                            {status === "WAIT_START" ? "เปิดงาน" : "ดูรายละเอียด"}
                          </Link>
                          <button
                            type="button"
                            className="ui-press rounded-lg bg-paper px-2 py-1.5 text-xs"
                            aria-label="เมนูเพิ่มเติม"
                            onClick={() => setMenuId(menuId === booking.id ? null : booking.id)}
                          >
                            •••
                          </button>
                          {menuId === booking.id ? (
                            <OpsMenu
                              booking={booking}
                              link={link}
                              copyFlash={copyFlash === link?.secureToken}
                              onCopy={() => link && copyDriverLink(link.secureToken)}
                              onOpenLink={() =>
                                link && window.open(driverJobPath(link.secureToken), "_blank")
                              }
                              onOpen={() => onOpen(booking.id)}
                              onCancel={() => {
                                setMenuId(null);
                                setCancelBooking(booking);
                              }}
                              onChangeVehicle={() => reassign(booking.id, "vehicle")}
                              onChangeDriver={() => reassign(booking.id, "driver")}
                              onClose={() => setMenuId(null)}
                              pending={pending}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {rows.map((booking) => {
              const vehicle = vehicles.find((item) => item.id === booking.assignedVehicleId);
              const driver = drivers.find((item) => item.id === booking.assignedDriverId);
              const status = resolveOpsJobStatus(booking, dayLogs);
              const link = driverLinkForBooking(driverLinks, booking.id);
              return (
                <article
                  key={booking.id}
                  className="ui-card rounded-2xl border border-line bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-semibold tabular-nums text-navy-800">
                      {booking.startTime ?? "—"}
                    </p>
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[11px]">
                      {OPS_JOB_STATUS_LABEL[status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-navy-800">
                    {booking.pickupLocation}
                    {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
                  </p>
                  <p className="text-sm text-muted">{booking.customerNameSnapshot}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {vehicle ? `${vehicle.brand} ${vehicle.model}` : "ยังไม่ได้จัดรถ"}
                    {" · "}
                    {driver ? driver.name : "ยังไม่ได้จัดคนขับ"}
                  </p>
                  <div className="relative mt-3 flex gap-2">
                    <Link
                      href={`/store/bookings/${booking.id}`}
                      className="ui-press flex-1 rounded-xl bg-[color:var(--store-accent,#C4A35A)] py-2.5 text-center text-sm font-semibold text-navy-950"
                    >
                      {status === "WAIT_START" ? "เปิดงาน" : "ดูรายละเอียด"}
                    </Link>
                    <button
                      type="button"
                      className="ui-press min-w-11 rounded-xl bg-paper px-3 text-sm"
                      aria-label="เมนูเพิ่มเติม"
                      onClick={() => setMenuId(menuId === booking.id ? null : booking.id)}
                    >
                      •••
                    </button>
                    {menuId === booking.id ? (
                      <OpsMenu
                        booking={booking}
                        link={link}
                        copyFlash={copyFlash === link?.secureToken}
                        onCopy={() => link && copyDriverLink(link.secureToken)}
                        onOpenLink={() =>
                          link && window.open(driverJobPath(link.secureToken), "_blank")
                        }
                        onOpen={() => onOpen(booking.id)}
                        onCancel={() => {
                          setMenuId(null);
                          setCancelBooking(booking);
                        }}
                        onChangeVehicle={() => reassign(booking.id, "vehicle")}
                        onChangeDriver={() => reassign(booking.id, "driver")}
                        onClose={() => setMenuId(null)}
                        pending={pending}
                        mobile
                      />
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {cancelBooking ? (
        <CancelBookingSheet
          booking={cancelBooking}
          onClose={() => setCancelBooking(null)}
          onDone={() => {
            setCancelBooking(null);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function OpsMenu({
  booking,
  link,
  copyFlash,
  onCopy,
  onOpenLink,
  onOpen,
  onCancel,
  onChangeVehicle,
  onChangeDriver,
  onClose,
  pending,
  mobile,
}: {
  booking: Booking;
  link: DriverJobLink | null;
  copyFlash: boolean;
  onCopy: () => void;
  onOpenLink: () => void;
  onOpen: () => void;
  onCancel: () => void;
  onChangeVehicle: () => void;
  onChangeDriver: () => void;
  onClose: () => void;
  pending: boolean;
  mobile?: boolean;
}) {
  return (
    <>
      <button type="button" className="fixed inset-0 z-40" aria-label="ปิดเมนู" onClick={onClose} />
      <div
        className={`absolute z-50 min-w-[11rem] rounded-xl border border-line bg-white py-1 text-sm shadow-lg ${
          mobile ? "right-0 bottom-12" : "right-0 top-9"
        }`}
      >
        <Link
          href={`/store/bookings/${booking.id}`}
          className="block px-3 py-2 hover:bg-paper"
          onClick={onClose}
        >
          ดูรายละเอียด
        </Link>
        <button type="button" className="block w-full px-3 py-2 text-left hover:bg-paper" onClick={onOpen}>
          แก้ไขงาน
        </button>
        <button
          type="button"
          disabled={pending}
          className="block w-full px-3 py-2 text-left hover:bg-paper disabled:opacity-50"
          onClick={onChangeVehicle}
        >
          เปลี่ยนรถ
        </button>
        <button
          type="button"
          disabled={pending}
          className="block w-full px-3 py-2 text-left hover:bg-paper disabled:opacity-50"
          onClick={onChangeDriver}
        >
          เปลี่ยนคนขับ
        </button>
        {link ? (
          <>
            <button type="button" className="block w-full px-3 py-2 text-left hover:bg-paper" onClick={onCopy}>
              {copyFlash ? "คัดลอกแล้ว" : "คัดลอกลิงก์คนขับ"}
            </button>
            <button type="button" className="block w-full px-3 py-2 text-left hover:bg-paper" onClick={onOpenLink}>
              เปิดลิงก์คนขับ
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="block w-full px-3 py-2 text-left text-danger hover:bg-paper"
          onClick={onCancel}
        >
          ยกเลิกงาน
        </button>
      </div>
    </>
  );
}
