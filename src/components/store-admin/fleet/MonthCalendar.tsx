"use client";

import {
  WEEKDAY_LABELS_TH,
  dateHasVehicleConflict,
  monthCalendarCells,
} from "@/lib/domain/fleet";
import {
  DAY_AVAILABILITY_DOT_CLASS,
  DAY_AVAILABILITY_LABELS,
  DAY_AVAILABILITY_TINT_CLASS,
  deriveDayAvailability,
  type DayAvailabilityStatus,
} from "@/lib/domain/day-availability";
import type { Booking, Vehicle } from "@/lib/domain/types";

export function MonthCalendar({
  monthDate,
  today,
  bookings,
  vehicles,
  selectedDate,
  onSelectDate,
  vehicleFilter = "",
  driverFilter = "",
}: {
  monthDate: string;
  today: string;
  bookings: Booking[];
  vehicles: Vehicle[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onOpenBooking?: (id: string) => void;
  vehicleFilter?: string;
  driverFilter?: string;
}) {
  const cells = monthCalendarCells(monthDate, today);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl bg-white">
        <div className="grid grid-cols-7 border-b border-line bg-paper text-center text-xs font-medium text-muted">
          {WEEKDAY_LABELS_TH.map((label) => (
            <div key={label} className="px-1 py-2.5">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {cells.map((cell) => {
            const availability = cell.inMonth
              ? deriveDayAvailability({
                  date: cell.date,
                  bookings,
                  vehicles,
                  vehicleId: vehicleFilter || null,
                  driverId: driverFilter || null,
                })
              : null;
            const conflict = cell.inMonth && dateHasVehicleConflict(bookings, cell.date);
            const selected = selectedDate === cell.date;
            const tint = availability ? DAY_AVAILABILITY_TINT_CLASS[availability.status] : "";
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => onSelectDate(cell.date)}
                aria-label={
                  availability
                    ? `${cell.day} ${availability.label} ${availability.summaryLine}`
                    : String(cell.day)
                }
                className={`min-h-[72px] border-b border-r border-line/70 p-1.5 text-left transition sm:min-h-[104px] lg:min-h-[120px] ${
                  cell.inMonth ? `bg-white hover:bg-paper/80 ${tint}` : "bg-paper/40 text-muted"
                } ${cell.isToday ? "ring-2 ring-inset ring-accent" : ""} ${
                  selected ? "bg-navy-800/8 ring-2 ring-inset ring-navy-800" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                      cell.isToday
                        ? "bg-navy-800 text-white"
                        : cell.inMonth
                          ? "text-navy-800"
                          : "text-muted"
                    }`}
                  >
                    {cell.day}
                  </span>
                  {availability && cell.inMonth ? (
                    <span
                      className={`h-2 w-2 rounded-full ${DAY_AVAILABILITY_DOT_CLASS[availability.status]}`}
                      title={availability.label}
                    />
                  ) : null}
                </div>
                {cell.inMonth && availability ? (
                  <>
                    <p className="hidden truncate text-[10px] font-semibold text-navy-800 sm:block">
                      ● {availability.label}
                    </p>
                    <p className="mt-0.5 hidden text-[10px] leading-snug text-muted sm:block">
                      {availability.summaryLine}
                    </p>
                    <p className="sm:hidden">
                      <span className="sr-only">{availability.label}</span>
                    </p>
                  </>
                ) : null}
                {conflict ? (
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-accent-deep">เวลาชนกัน</p>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <AvailabilityLegend />
    </div>
  );
}

function AvailabilityLegend() {
  const items = Object.entries(DAY_AVAILABILITY_LABELS) as [DayAvailabilityStatus, string][];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 text-[11px] text-muted scrollbar-none">
      {items.map(([status, label]) => (
        <span key={status} className="inline-flex shrink-0 items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${DAY_AVAILABILITY_DOT_CLASS[status]}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
