"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { BookingQuickView } from "@/components/store-admin/fleet/BookingQuickView";
import { DayJobsDrawer } from "@/components/store-admin/fleet/DayJobsDrawer";
import { DriverAvatar } from "@/components/store-admin/fleet/DriverAvatar";
import { FleetStateBadge } from "@/components/store-admin/fleet/FleetStateBadge";
import { MonthCalendar } from "@/components/store-admin/fleet/MonthCalendar";
import { VehiclePhoto } from "@/components/store-admin/fleet/VehiclePhoto";
import { DispatchOpsJobList } from "@/components/store-admin/fleet/DispatchOpsJobList";
import {
  DISPATCH_HOURS,
  activeJobs,
  addMonths,
  bookingConflictsWithOthers,
  bookingEndDate,
  datesInRange,
  dispatchSummary,
  fleetVisualLabel,
  fleetVisualState,
  formatDuration,
  jobsOnDate,
  monthDispatchSummary,
  monthRange,
  multiDayBlockStyle,
  operationalVehicles,
  overlapsDate,
  ownershipLabel,
  timelineBlockStyle,
  unassignedDriverJobs,
  unassignedVehicleJobs,
  vehicleHasConflict,
  weekStartMonday,
} from "@/lib/domain/fleet";
import {
  bookingsOnSelectedDispatchDate,
  operationalDispatchBookings,
} from "@/lib/domain/dispatch-ops";
import { addDays, formatThaiDate, formatThaiMonthYear } from "@/lib/domain/ops";
import { statusPresentation } from "@/lib/domain/status-ui";
import {
  TRIP_PROGRESS_LABEL,
  deriveTripProgressFromBooking,
} from "@/lib/domain/location";
import type { Booking, Driver, DriverDayWorkLog, DriverJobLink, Vehicle } from "@/lib/domain/types";

export type DispatchView = "today" | "week" | "month" | "list";

export function DispatchBoard({
  date,
  today,
  view,
  bookings,
  vehicles,
  drivers,
  dayLogs = [],
  driverLinks = [],
  compact = false,
}: {
  date: string;
  today: string;
  view: DispatchView;
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  dayLogs?: DriverDayWorkLog[];
  driverLinks?: DriverJobLink[];
  compact?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dayDrawer, setDayDrawer] = useState<string | null>(null);
  const [listDate, setListDate] = useState<string | null>(null);
  const [ownership, setOwnership] = useState<"ALL" | "OWN" | "PARTNER">("ALL");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");

  const weekAnchor = weekStartMonday(date);
  const range =
    view === "today"
      ? { start: date, end: date }
      : view === "month"
        ? monthRange(date)
        : view === "week"
          ? { start: weekAnchor, end: addDays(weekAnchor, 6) }
          : { start: addDays(today, -7), end: addDays(today, 30) };
  const days = datesInRange(range.start, range.end);
  const opsVehicles = operationalVehicles(vehicles).filter((item) => {
    if (ownership !== "ALL" && item.ownershipType !== ownership) return false;
    if (vehicleFilter && item.id !== vehicleFilter) return false;
    return true;
  });

  const filteredBookings = useMemo(() => {
    return activeJobs(bookings).filter((item) => {
      if (driverFilter && item.assignedDriverId !== driverFilter) return false;
      if (vehicleFilter && item.assignedVehicleId !== vehicleFilter) return false;
      if (ownership !== "ALL") {
        if (!item.assignedVehicleId) return ownership === "OWN" ? false : true;
        const vehicle = vehicles.find((row) => row.id === item.assignedVehicleId);
        if (!vehicle) return true;
        if (vehicle.ownershipType !== ownership) return false;
      }
      return true;
    });
  }, [bookings, driverFilter, vehicleFilter, ownership, vehicles]);

  const listAnchor =
    listDate ?? (view === "today" ? date : view === "month" ? dayDrawer : null);
  const listBookings = bookingsOnSelectedDispatchDate(
    operationalDispatchBookings(filteredBookings),
    listAnchor,
    { start: range.start, end: range.end },
  );

  const daySummary = dispatchSummary(opsVehicles, filteredBookings, view === "today" ? date : today);
  const monthSummary = monthDispatchSummary(filteredBookings, date);
  const noVehicle = unassignedVehicleJobs(filteredBookings, range);
  const noDriver = unassignedDriverJobs(filteredBookings, range);
  const selected = bookings.find((item) => item.id === selectedId) ?? null;

  const navLabel =
    view === "month"
      ? formatThaiMonthYear(date)
      : view === "week"
        ? `${formatThaiDate(range.start)} – ${formatThaiDate(range.end)}`
        : formatThaiDate(date);

  const prevHref =
    view === "month"
      ? `/store/calendar?view=month&date=${addMonths(date, -1)}`
      : view === "week"
        ? `/store/calendar?view=week&date=${addDays(weekAnchor, -7)}`
        : view === "today"
          ? `/store/calendar?view=today&date=${addDays(date, -1)}`
          : `/store/calendar?view=list&date=${addDays(date, -1)}`;
  const nextHref =
    view === "month"
      ? `/store/calendar?view=month&date=${addMonths(date, 1)}`
      : view === "week"
        ? `/store/calendar?view=week&date=${addDays(weekAnchor, 7)}`
        : view === "today"
          ? `/store/calendar?view=today&date=${addDays(date, 1)}`
          : `/store/calendar?view=list&date=${addDays(date, 1)}`;

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted">ตารางเดินรถ</p>
            <h1 className="text-2xl font-semibold text-navy-800">คิวงาน</h1>
          </div>
        </div>
      ) : null}

      {!compact ? (
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["today", "วันนี้"],
              ["week", "7 วัน"],
              ["month", "เดือน"],
              ["list", "รายการ"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={`/store/calendar?view=${key}&date=${key === "week" ? weekStartMonday(today) : key === "month" ? `${today.slice(0, 7)}-01` : today}`}
              className={`rounded-full px-3 py-2 text-sm transition ${
                view === key ? "bg-accent text-navy-950" : "bg-white text-navy-800 hover:bg-paper"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link href={prevHref} className="rounded-full bg-white px-3 py-2 text-sm">
            ←
          </Link>
          <span className="min-w-[8rem] text-center text-sm font-medium text-navy-800">{navLabel}</span>
          <Link href={nextHref} className="rounded-full bg-white px-3 py-2 text-sm">
            →
          </Link>
          <Link
            href={`/store/calendar?view=${view}&date=${view === "week" ? weekStartMonday(today) : view === "month" ? `${today.slice(0, 7)}-01` : today}`}
            className="rounded-full bg-navy-800 px-3 py-2 text-sm text-white"
          >
            วันนี้
          </Link>
        </div>
      ) : null}

      {!compact ? (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["ALL", "ทั้งหมด"],
              ["OWN", "รถตัวเอง"],
              ["PARTNER", "รถทีม"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setOwnership(key)}
              className={`rounded-full px-3 py-1.5 text-xs ${
                ownership === key ? "bg-navy-800 text-white" : "bg-white text-navy-800"
              }`}
            >
              {label}
            </button>
          ))}
          <select
            className="admin-input h-9 max-w-[11rem] rounded-full py-0 text-xs"
            value={vehicleFilter}
            onChange={(event) => setVehicleFilter(event.target.value)}
          >
            <option value="">รถทั้งหมด</option>
            {operationalVehicles(vehicles).map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.model} · {ownershipLabel(vehicle.ownershipType)}
              </option>
            ))}
          </select>
          <select
            className="admin-input h-9 max-w-[11rem] rounded-full py-0 text-xs"
            value={driverFilter}
            onChange={(event) => setDriverFilter(event.target.value)}
          >
            <option value="">คนขับทั้งหมด</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        {view === "month" ? (
          <>
            <Mini label="งานเดือนนี้" value={monthSummary.jobsMonth} />
            <Mini label="งานยืนยันแล้ว" value={monthSummary.confirmed} />
            <Mini label="งานสำเร็จ" value={monthSummary.completed} />
            <Mini label="ยังไม่ได้จัดรถ" value={monthSummary.noVehicle} />
          </>
        ) : (
          <>
            <Mini label={view === "week" ? "งานสัปดาห์นี้" : "งานวันนี้"} value={view === "week" ? activeJobs(filteredBookings).filter((item) => item.startDate <= range.end && bookingEndDate(item) >= range.start).length : daySummary.jobsToday} />
            <Mini label="รถออกงาน" value={daySummary.vehiclesOnJob} />
            <Mini label="ยังไม่มีรถ" value={noVehicle.length} />
            <Mini label="ยังไม่มีคนขับ" value={noDriver.length} />
          </>
        )}
      </dl>

      {(view === "today" || view === "week") && (noVehicle.length || noDriver.length) ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {noVehicle.length ? (
            <Lane title="ยังไม่ได้จัดรถ" items={noVehicle} vehicles={vehicles} drivers={drivers} onOpen={setSelectedId} action="จัดรถ" />
          ) : null}
          {noDriver.length ? (
            <Lane title="ยังไม่มีคนขับ" items={noDriver} vehicles={vehicles} drivers={drivers} onOpen={setSelectedId} action="จัดคนขับ" />
          ) : null}
        </div>
      ) : null}

      {view === "month" ? (
        <MonthCalendar
          monthDate={date}
          today={today}
          bookings={filteredBookings}
          vehicles={opsVehicles}
          selectedDate={dayDrawer}
          onSelectDate={(day) => {
            setDayDrawer(day);
            setListDate(day);
          }}
          onOpenBooking={setSelectedId}
          vehicleFilter={vehicleFilter}
          driverFilter={driverFilter}
        />
      ) : null}

      {view === "today" ? (
        <TodayDispatch
          date={date}
          vehicles={opsVehicles}
          bookings={filteredBookings}
          drivers={drivers}
          selectedId={selectedId}
          onOpen={setSelectedId}
        />
      ) : null}

      {view === "week" ? (
        <WeekDispatch
          days={days}
          vehicles={opsVehicles}
          bookings={filteredBookings}
          drivers={drivers}
          selectedId={selectedId}
          onOpen={setSelectedId}
        />
      ) : null}

      {view === "list" ? (
        <ListDispatch
          bookings={filteredBookings}
          vehicles={vehicles}
          drivers={drivers}
          range={range}
          onOpen={setSelectedId}
        />
      ) : null}

      {!compact ? (
        <DispatchOpsJobList
          bookings={listBookings}
          vehicles={vehicles}
          drivers={drivers}
          dayLogs={dayLogs}
          driverLinks={driverLinks}
          selectedDate={listAnchor}
          onOpen={setSelectedId}
        />
      ) : null}

      {dayDrawer ? (
        <DayJobsDrawer
          date={dayDrawer}
          bookings={filteredBookings}
          vehicles={opsVehicles}
          drivers={drivers}
          vehicleFilter={vehicleFilter}
          driverFilter={driverFilter}
          onClose={() => setDayDrawer(null)}
          onOpenBooking={(id) => {
            setDayDrawer(null);
            setSelectedId(id);
          }}
        />
      ) : null}

      {selected ? (
        <BookingQuickView
          booking={selected}
          vehicle={vehicles.find((item) => item.id === selected.assignedVehicleId)}
          driver={drivers.find((item) => item.id === selected.assignedDriverId)}
          vehicles={vehicles}
          drivers={drivers}
          bookings={bookings}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium text-navy-800">{value}</dd>
    </div>
  );
}

function Lane({
  title,
  items,
  vehicles,
  drivers,
  onOpen,
  action,
}: {
  title: string;
  items: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  onOpen: (id: string) => void;
  action: string;
}) {
  return (
    <section className="rounded-2xl border border-accent/40 bg-white p-3">
      <h2 className="text-sm font-semibold text-navy-800">
        {title} · {items.length}
      </h2>
      <div className="mt-2 space-y-2">
        {items.map((booking) => {
          const driver = drivers.find((item) => item.id === booking.assignedDriverId);
          const vehicle = vehicles.find((item) => item.id === booking.assignedVehicleId);
          return (
            <button
              key={booking.id}
              type="button"
              onClick={() => onOpen(booking.id)}
              className="flex w-full items-center justify-between rounded-xl bg-paper px-3 py-2 text-left text-sm"
            >
              <span>
                <span className="font-medium">{booking.bookingCode}</span>
                {" · "}
                {booking.customerNameSnapshot}
                <span className="mt-1 block text-xs text-muted">
                  {formatThaiDate(booking.startDate)} {booking.startTime ?? ""} · {formatDuration(booking)}
                  {vehicle ? ` · ${vehicle.model}` : ""}
                  {driver ? ` · ${driver.name}` : ""}
                  {" · "}
                  {booking.pickupLocation}
                  {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
                </span>
              </span>
              <span className="text-xs font-semibold text-accent-deep">{action}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TodayDispatch({
  date,
  vehicles,
  bookings,
  drivers,
  selectedId,
  onOpen,
}: {
  date: string;
  vehicles: Vehicle[];
  bookings: Booking[];
  drivers: Driver[];
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  if (vehicles.length === 0) return <EmptyState title="ยังไม่มีคิวรถวันนี้" />;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl bg-white lg:block">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[220px_1fr] border-b border-line bg-paper text-xs text-muted">
            <div className="px-4 py-2">รถ</div>
            <div className="grid grid-cols-7 px-2 py-2">
              {DISPATCH_HOURS.map((hour) => (
                <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
              ))}
            </div>
          </div>
          {vehicles.map((vehicle) => (
            <VehicleRail
              key={vehicle.id}
              vehicle={vehicle}
              bookings={bookings}
              drivers={drivers}
              date={date}
              selectedId={selectedId}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
      <div className="space-y-4 lg:hidden">
        {vehicles.map((vehicle) => {
          const jobs = bookings.filter(
            (item) => item.assignedVehicleId === vehicle.id && overlapsDate(item, date),
          );
          const driver = drivers.find((item) => item.id === jobs[0]?.assignedDriverId);
          const conflict = vehicleHasConflict(bookings, vehicle.id, { start: date, end: date });
          return (
            <section key={vehicle.id} className="rounded-2xl bg-white p-3">
              <div className="mb-2 flex items-center gap-3">
                <div className="h-12 w-16 overflow-hidden rounded-xl">
                  <VehiclePhoto vehicle={vehicle} />
                </div>
                <div>
                  <p className="font-medium text-navy-800">
                    {vehicle.brand} {vehicle.model}
                  </p>
                  <p className="text-xs text-muted">
                    {vehicle.plateNumber} · {ownershipLabel(vehicle.ownershipType)}
                  </p>
                  {conflict ? <p className="text-xs font-semibold text-accent-deep">เวลาชนกัน</p> : null}
                </div>
              </div>
              {jobs.length === 0 ? <p className="text-sm text-muted">ว่าง</p> : null}
              {jobs.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onOpen(booking.id)}
                  className="mt-2 w-full rounded-xl bg-paper px-3 py-2 text-left"
                >
                  <p className="text-xs text-muted">
                    {booking.startTime ?? "ทั้งวัน"} · {formatDuration(booking)}
                    {bookingConflictsWithOthers(booking, bookings) ? " · เวลาชนกัน" : ""}
                  </p>
                  <p className="font-medium">{booking.customerNameSnapshot}</p>
                  <p className="text-sm">
                    {booking.pickupLocation}
                    {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
                  </p>
                  {driver ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <DriverAvatar driver={driver} /> {driver.name}
                    </p>
                  ) : null}
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

function WeekDispatch({
  days,
  vehicles,
  bookings,
  drivers,
  selectedId,
  onOpen,
}: {
  days: string[];
  vehicles: Vehicle[];
  bookings: Booking[];
  drivers: Driver[];
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  if (vehicles.length === 0) return <EmptyState title="ยังไม่มีคิวรถในช่วงนี้" />;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl bg-white lg:block">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-[180px_1fr] border-b border-line bg-paper text-xs text-muted">
            <div className="px-4 py-2">รถ</div>
            <div className="grid px-2 py-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))` }}>
              {days.map((day) => (
                <span key={day}>{formatThaiDate(day)}</span>
              ))}
            </div>
          </div>
          {vehicles.map((vehicle) => (
            <MultiDayRail
              key={vehicle.id}
              vehicle={vehicle}
              bookings={bookings}
              drivers={drivers}
              days={days}
              selectedId={selectedId}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
      <div className="space-y-4 lg:hidden">
        {days.map((day) => {
          const jobs = jobsOnDate(bookings, day);
          return (
            <section key={day} className="rounded-2xl bg-white p-3">
              <h3 className="font-semibold text-navy-800">{formatThaiDate(day)}</h3>
              {jobs.length === 0 ? <p className="mt-2 text-sm text-muted">ว่าง</p> : null}
              {jobs.map((booking) => {
                const vehicle = vehicles.find((item) => item.id === booking.assignedVehicleId);
                const driver = drivers.find((item) => item.id === booking.assignedDriverId);
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onOpen(booking.id)}
                    className="mt-2 w-full rounded-xl bg-paper px-3 py-2 text-left"
                  >
                    <p className="text-xs text-muted">
                      {booking.startTime ?? "ทั้งวัน"} · {formatDuration(booking)}
                      {bookingConflictsWithOthers(booking, bookings) ? " · เวลาชนกัน" : ""}
                    </p>
                    <p className="font-medium">{booking.customerNameSnapshot}</p>
                    <p className="text-sm">
                      {vehicle ? `${vehicle.model}` : "ยังไม่มีรถ"}
                      {driver ? ` · ${driver.name}` : " · ยังไม่มีคนขับ"}
                    </p>
                    <p className="text-sm text-muted">
                      {booking.pickupLocation}
                      {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
                    </p>
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}

function ListDispatch({
  bookings,
  vehicles,
  drivers,
  range,
  onOpen,
}: {
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  range: { start: string; end: string };
  onOpen: (id: string) => void;
}) {
  const rows = activeJobs(bookings)
    .filter((item) => item.startDate <= range.end && bookingEndDate(item) >= range.start)
    .sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      return (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.bookingCode.localeCompare(b.bookingCode);
    });

  if (!rows.length) return <EmptyState title="ไม่มีงานในรายการนี้" />;

  return (
    <div className="overflow-hidden rounded-2xl bg-white">
      <ul className="divide-y divide-line">
        {rows.map((booking) => {
          const vehicle = vehicles.find((item) => item.id === booking.assignedVehicleId);
          const driver = drivers.find((item) => item.id === booking.assignedDriverId);
          const tone = statusPresentation(booking.status);
          return (
            <li key={booking.id}>
              <button
                type="button"
                onClick={() => onOpen(booking.id)}
                className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-paper sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-xs text-muted">
                    {formatThaiDate(booking.startDate)}
                    {booking.endDate && booking.endDate !== booking.startDate ? ` → ${formatThaiDate(booking.endDate)}` : ""}{" "}
                    · {booking.startTime ?? "ทั้งวัน"} · {formatDuration(booking)}
                  </p>
                  <p className="font-medium text-navy-800">
                    {booking.bookingCode} · {booking.customerNameSnapshot}
                  </p>
                  <p className="text-sm text-muted">
                    {vehicle ? `${vehicle.brand} ${vehicle.model}` : "ยังไม่มีรถ"}
                    {" · "}
                    {driver?.name ?? "ยังไม่มีคนขับ"}
                    {" · "}
                    {booking.pickupLocation}
                    {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs ${tone.badgeClass}`}>{tone.label}</span>
                  {["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status) ? (
                    <span className="text-[11px] text-muted">
                      {TRIP_PROGRESS_LABEL[deriveTripProgressFromBooking(booking)]}
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function VehicleRail({
  vehicle,
  bookings,
  drivers,
  date,
  selectedId,
  onOpen,
}: {
  vehicle: Vehicle;
  bookings: Booking[];
  drivers: Driver[];
  date: string;
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  const jobs = bookings.filter((item) => item.assignedVehicleId === vehicle.id);
  const state = fleetVisualState(vehicle, bookings, "vehicle", date);
  const conflict = vehicleHasConflict(bookings, vehicle.id, { start: date, end: date });
  return (
    <div className="grid grid-cols-[220px_1fr] border-t border-line">
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="h-12 w-16 overflow-hidden rounded-xl">
          <VehiclePhoto vehicle={vehicle} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-navy-800">
            {vehicle.brand} {vehicle.model}
          </p>
          <p className="truncate text-xs text-muted">
            {vehicle.plateNumber} · {ownershipLabel(vehicle.ownershipType)}
          </p>
          <FleetStateBadge state={state} />
          {conflict ? <p className="mt-1 text-[11px] font-semibold text-accent-deep">เวลาชนกัน</p> : null}
        </div>
      </div>
      <div className="relative min-h-20 bg-[linear-gradient(to_right,transparent_0,transparent_calc(100%/6-1px),#e6e8ec_calc(100%/6-1px),#e6e8ec_calc(100%/6),transparent_calc(100%/6))] bg-[length:calc(100%/6)_100%]">
        {jobs.map((booking) => {
          const style = timelineBlockStyle(booking, date);
          if (!style) return null;
          const driver = drivers.find((item) => item.id === booking.assignedDriverId);
          const tone = statusPresentation(booking.status);
          const clashes = bookingConflictsWithOthers(booking, bookings);
          return (
            <button
              key={booking.id}
              type="button"
              onClick={() => onOpen(booking.id)}
              style={{ left: style.left, width: style.width }}
              className={`absolute top-3 h-14 overflow-hidden rounded-xl border px-2 py-1 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone.badgeClass} ${
                selectedId === booking.id ? "ring-2 ring-accent" : ""
              } ${clashes ? "ring-1 ring-accent-deep" : ""}`}
            >
              <p className="truncate text-xs font-semibold">{booking.customerNameSnapshot}</p>
              <p className="truncate text-[11px]">
                {booking.pickupLocation}
                {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
              </p>
              <p className="truncate text-[11px]">
                {driver?.name ?? "ยังไม่มีคนขับ"} · {formatDuration(booking)}
                {clashes ? " · เวลาชนกัน" : style.inferred ? " · ประมาณเวลา" : ""}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiDayRail({
  vehicle,
  bookings,
  drivers,
  days,
  selectedId,
  onOpen,
}: {
  vehicle: Vehicle;
  bookings: Booking[];
  drivers: Driver[];
  days: string[];
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  const jobs = bookings.filter(
    (item) =>
      item.assignedVehicleId === vehicle.id &&
      item.startDate <= days[days.length - 1] &&
      bookingEndDate(item) >= days[0],
  );
  const state = fleetVisualState(vehicle, bookings, "vehicle", days[0]);
  const conflict = vehicleHasConflict(bookings, vehicle.id, { start: days[0], end: days[days.length - 1] });
  return (
    <div className="grid grid-cols-[180px_1fr] border-t border-line">
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="h-10 w-14 overflow-hidden rounded-lg">
          <VehiclePhoto vehicle={vehicle} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{vehicle.model}</p>
          <p className="truncate text-[10px] text-muted">{ownershipLabel(vehicle.ownershipType)}</p>
          <FleetStateBadge state={state} label={fleetVisualLabel(state, null)} />
          {conflict ? <p className="text-[10px] font-semibold text-accent-deep">เวลาชนกัน</p> : null}
        </div>
      </div>
      <div className="relative min-h-16">
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))` }}>
          {days.map((day) => (
            <div key={day} className="border-l border-line/70" />
          ))}
        </div>
        {jobs.map((booking) => {
          const style = multiDayBlockStyle(booking, days);
          if (!style) return null;
          const driver = drivers.find((item) => item.id === booking.assignedDriverId);
          const tone = statusPresentation(booking.status);
          const clashes = bookingConflictsWithOthers(booking, bookings);
          return (
            <button
              key={booking.id}
              type="button"
              onClick={() => onOpen(booking.id)}
              style={{ left: style.left, width: style.width }}
              className={`absolute top-2 h-12 overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] shadow-sm transition hover:shadow-md ${tone.badgeClass} ${
                selectedId === booking.id ? "ring-2 ring-accent" : ""
              } ${clashes ? "ring-1 ring-accent-deep" : ""}`}
            >
              <p className="truncate font-semibold">{booking.customerNameSnapshot}</p>
              <p className="truncate">
                {booking.pickupLocation}
                {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
              </p>
              <p className="truncate">
                {formatDuration(booking)} · {driver?.name ?? "ยังไม่มีคนขับ"}
                {clashes
                  ? " · เวลาชนกัน"
                  : ` · ${tone.label} · ${TRIP_PROGRESS_LABEL[deriveTripProgressFromBooking(booking)]}`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
