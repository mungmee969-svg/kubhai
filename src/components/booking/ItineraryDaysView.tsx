"use client";

import {
  groupItineraryByDay,
  kindLabel,
} from "@/lib/booking/itinerary";
import { formatThaiDate } from "@/lib/domain/ops";
import type { BookingItineraryItem } from "@/lib/domain/types";

/** Operational day-by-day itinerary for Store Admin (no raw JSON dump). */
export function BookingItineraryDays({
  itinerary,
  startDate,
  endDate,
  letStorePlanTrip,
}: {
  itinerary: BookingItineraryItem[];
  startDate: string;
  endDate: string | null;
  letStorePlanTrip?: boolean;
}) {
  const tripDays = itinerary.filter((item) => (item.dayNumber ?? 0) > 0);
  const help = itinerary.filter(
    (item) => item.kind === "STORE_HELP" || (item.dayNumber ?? 0) === 0,
  );
  const grouped = groupItineraryByDay(tripDays);
  const dayNumbers = [...grouped.keys()].sort((a, b) => a - b);

  if (!dayNumbers.length && !help.length) {
    return <p className="text-sm text-muted">ยังไม่มีแผนรายวัน</p>;
  }

  const spanLabel = endDate
    ? `${formatThaiDate(startDate)} – ${formatThaiDate(endDate)}`
    : formatThaiDate(startDate);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-navy-800">
          ทริป {dayNumbers.length || "—"} วัน
        </span>
        <span className="text-muted">{spanLabel}</span>
        {letStorePlanTrip ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
            ให้ร้านช่วยจัดทริป
          </span>
        ) : null}
      </div>

      {dayNumbers.map((day) => {
        const items = grouped.get(day) ?? [];
        const start = items.find((i) => i.kind === "START");
        const final = items.find((i) => i.kind === "FINAL");
        const end = items.find((i) => i.kind === "END_OF_DAY");
        const stops = items.filter((i) => i.kind === "STOP");
        const undecided = items.find((i) => i.kind === "UNDECIDED");
        return (
          <div key={day} className="rounded-xl bg-paper px-3 py-3 text-sm">
            <p className="font-semibold text-navy-800">วันที่ {day}</p>
            {undecided ? (
              <p className="mt-1 text-muted">{undecided.title}</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {start ? (
                  <li>
                    <span className="text-xs text-muted">
                      {day === 1 ? "จุดรับเริ่มต้น" : "เริ่ม"} ·{" "}
                    </span>
                    {start.title}
                    {start.note ? <span className="text-xs text-muted"> · {start.note}</span> : null}
                  </li>
                ) : null}
                {stops.map((stop) => (
                  <li key={stop.id}>
                    <span className="text-xs text-muted">แวะ · </span>
                    {stop.title}
                  </li>
                ))}
                {end ? (
                  <li>
                    <span className="text-xs text-muted">จบวัน / ที่พัก · </span>
                    {end.title}
                  </li>
                ) : null}
                {final ? (
                  <li>
                    <span className="text-xs font-medium text-navy-800">จุดส่งสุดท้าย · </span>
                    {final.title}
                    {final.note ? <span className="text-xs text-muted"> · {final.note}</span> : null}
                  </li>
                ) : null}
                {!start && !stops.length && !end && !final
                  ? items.map((item) => (
                      <li key={item.id}>
                        <span className="text-xs text-muted">{kindLabel(item.kind)} · </span>
                        {item.title}
                      </li>
                    ))
                  : null}
              </ul>
            )}
          </div>
        );
      })}

      {help.length ? (
        <div className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">
          {help.map((item) => (
            <p key={item.id}>
              {item.title}
              {item.note ? ` — ${item.note}` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function QuotationItinerarySummary({
  itinerary,
  startDate,
  endDate,
}: {
  itinerary: BookingItineraryItem[];
  startDate: string;
  endDate: string | null;
}) {
  const tripDays = itinerary.filter((item) => (item.dayNumber ?? 0) > 0);
  if (!tripDays.length) return null;
  const grouped = groupItineraryByDay(tripDays);
  const days = [...grouped.keys()].sort((a, b) => a - b);
  const start = tripDays.find((i) => i.kind === "START");
  const final = [...tripDays].reverse().find((i) => i.kind === "FINAL");

  return (
    <div className="rounded-2xl bg-paper p-4 text-sm">
      <p className="text-xs text-muted">แผนทริป</p>
      <p className="mt-1 font-medium">
        {days.length} วัน
        {endDate ? ` · ${formatThaiDate(startDate)} – ${formatThaiDate(endDate)}` : ""}
      </p>
      {start ? <p className="mt-1 text-muted">รับ: {start.title}</p> : null}
      {final ? <p className="text-muted">ส่งสุดท้าย: {final.title}</p> : null}
      <ul className="mt-2 space-y-1 text-xs text-muted">
        {days.map((day) => {
          const items = grouped.get(day) ?? [];
          const stops = items.filter((i) => i.kind === "STOP").length;
          const undecided = items.some((i) => i.kind === "UNDECIDED");
          return (
            <li key={day}>
              วัน {day}
              {undecided
                ? " — ยังไม่วางแผน"
                : stops
                  ? ` — ${stops} จุดแวะ`
                  : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
