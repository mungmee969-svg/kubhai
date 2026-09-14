"use client";

import {
  formatThaiShortDate,
  resolveDayStart,
  type DayPlan,
} from "@/lib/booking/itinerary";

export function DayCard({
  day,
  previous,
  isFirst,
  isLast,
  onEdit,
}: {
  day: DayPlan;
  previous: DayPlan | null;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
}) {
  const start = resolveDayStart(day, previous);

  return (
    <article className="rounded-[1.25rem] bg-white px-4 py-3.5 shadow-[0_4px_16px_rgba(15,23,36,0.05)]">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[color:var(--store-ink,#0F1724)]">
          วันที่ {day.dayNumber}
        </h3>
        <p className="text-xs text-muted">{formatThaiShortDate(day.date)}</p>
      </div>

      {day.undecided ? (
        <p className="mt-3 rounded-xl bg-[color:var(--store-primary-soft,#E7EFEA)] px-3 py-2 text-sm text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]">
          ยังไม่ได้วางแผน · ให้ร้านช่วยแนะนำ
        </p>
      ) : (
        <div className="relative mt-3 space-y-0 pl-1">
          <TimelineRow
            last={false}
            strong
            label={
              isFirst
                ? start?.label || "จุดรับเริ่มต้น"
                : start?.label || "เริ่มวันนี้"
            }
            meta={day.startTime || undefined}
            muted={!start}
          />
          {day.stops.map((stop) => (
            <TimelineRow key={`${day.dayNumber}-${stop.label}`} last={false} label={stop.label} />
          ))}
          <TimelineRow
            last
            strong
            label={
              isLast
                ? day.endLocation?.label || "จุดส่งสุดท้าย"
                : day.endLocation?.label || "จบวัน / ที่พัก"
            }
            meta={isLast ? day.endTime || undefined : undefined}
            muted={!day.endLocation}
          />
          <p className="pt-2 text-xs text-muted">
            {day.stops.length ? `${day.stops.length} จุดแวะ` : "ไม่มีจุดแวะ"}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onEdit}
        className="mt-3 min-h-11 text-xs font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
      >
        แก้ไขแผนวันนี้
      </button>
    </article>
  );
}

function TimelineRow({
  label,
  meta,
  muted,
  strong,
  last,
}: {
  label: string;
  meta?: string;
  muted?: boolean;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-3 pb-3">
      {!last ? (
        <span
          className="absolute left-[5px] top-3 bottom-0 w-px bg-[color:var(--store-primary,#0F3D3E)]/25"
          aria-hidden
        />
      ) : null}
      <span
        className={`relative z-[1] mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
          strong
            ? "bg-[color:var(--store-primary,#0F3D3E)]"
            : "bg-[color:var(--store-accent,#C4A35A)]"
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${muted ? "text-muted" : strong ? "font-semibold" : "font-medium"}`}>
          {label}
        </p>
        {meta ? <p className="text-xs text-muted">{meta}</p> : null}
      </div>
    </div>
  );
}

export type { DayPlan };
