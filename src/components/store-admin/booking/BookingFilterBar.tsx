"use client";

import { useState } from "react";
import Link from "next/link";
import { BOOKING_STATUSES, BOOKING_SOURCES } from "@/lib/domain/enums";
import { OPS_INBOX_FILTERS } from "@/lib/domain/booking-ops-next";
import { statusLabel } from "@/lib/domain/status-ui";

export function BookingFilterBar({
  filter,
  counts,
  query,
  vehicles,
  drivers,
}: {
  filter: string;
  counts: Record<string, number>;
  query: { q?: string; date?: string; vehicle?: string; driver?: string; source?: string };
  vehicles: Array<{ id: string; brand: string; model: string }>;
  drivers: Array<{ id: string; name: string }>;
}) {
  const routerQuery = query;
  const [open, setOpen] = useState(false);
  const advanced = [
    ...BOOKING_STATUSES,
    "TODAY",
    "NO_VEHICLE",
    "NO_DRIVER",
    "WAITING_BALANCE",
  ] as const;

  function hrefFor(key: string) {
    const params = new URLSearchParams();
    params.set("filter", key);
    if (routerQuery.q) params.set("q", routerQuery.q);
    if (routerQuery.date) params.set("date", routerQuery.date);
    if (routerQuery.vehicle) params.set("vehicle", routerQuery.vehicle);
    if (routerQuery.driver) params.set("driver", routerQuery.driver);
    if (routerQuery.source) params.set("source", routerQuery.source);
    return `/store/bookings?${params.toString()}`;
  }

  return (
    <div className="space-y-3">
      <form action="/store/bookings" method="get" className="flex gap-2">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="ค้นหาชื่อ / เบอร์โทร / Booking"
          className="admin-input flex-1"
          aria-label="ค้นหา"
        />
        <button type="submit" className="h-11 shrink-0 rounded-xl bg-[color:var(--store-primary,#0F3D3E)] px-4 text-sm text-white">
          ค้นหา
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {OPS_INBOX_FILTERS.map(({ key, label }) => {
          const count = counts[key] ?? 0;
          const active = filter === key;
          return (
            <Link
              key={key}
              href={hrefFor(key)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm ${
                active
                  ? "bg-[color:var(--store-primary,#0F3D3E)] font-semibold text-white"
                  : "bg-white text-navy-800"
              }`}
            >
              {label}
              {key !== "ALL" ? ` ${count}` : count ? ` ${count}` : ""}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full bg-white px-3.5 py-2 text-sm text-navy-800"
        >
          ตัวกรอง
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-navy-950/35" onClick={() => setOpen(false)} aria-label="ปิด" />
          <aside className="kh-drawer absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-semibold text-navy-800">ตัวกรองเพิ่มเติม</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">
                ปิด
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {advanced
                  .filter((key) => (counts[key] ?? 0) > 0 || key === "TODAY")
                  .map((key) => (
                    <Link
                      key={key}
                      href={hrefFor(key)}
                      onClick={() => setOpen(false)}
                      className={`rounded-full px-3 py-2 text-sm ${
                        filter === key ? "bg-navy-800 text-white" : "bg-paper text-navy-800"
                      }`}
                    >
                      {key === "TODAY"
                        ? "วันนี้"
                        : key === "NO_VEHICLE"
                          ? "ยังไม่มีรถ"
                          : key === "NO_DRIVER"
                            ? "ยังไม่มีคนขับ"
                            : key === "WAITING_BALANCE"
                              ? "ค้างชำระ"
                              : statusLabel(key as (typeof BOOKING_STATUSES)[number])}{" "}
                      {counts[key] ?? 0}
                    </Link>
                  ))}
              </div>

              <form action="/store/bookings" method="get" className="space-y-3">
                <input type="hidden" name="filter" value={filter} />
                {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">วันที่เริ่ม</span>
                  <input className="admin-input" type="date" name="date" defaultValue={query.date ?? ""} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">รถ</span>
                  <select className="admin-input" name="vehicle" defaultValue={query.vehicle ?? ""}>
                    <option value="">ทั้งหมด</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.brand} {vehicle.model}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">คนขับ</span>
                  <select className="admin-input" name="driver" defaultValue={query.driver ?? ""}>
                    <option value="">ทั้งหมด</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">แหล่งที่มา</span>
                  <select className="admin-input" name="source" defaultValue={query.source ?? ""}>
                    <option value="">ทั้งหมด</option>
                    {BOOKING_SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="h-11 w-full rounded-xl bg-navy-800 text-sm text-white">
                  ใช้ตัวกรอง
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
