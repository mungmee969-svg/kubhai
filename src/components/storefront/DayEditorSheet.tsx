"use client";

import { useState } from "react";
import {
  formatThaiShortDate,
  resolveDayStart,
  type DayPlan,
} from "@/lib/booking/itinerary";
import type { StructuredLocation } from "@/lib/domain/location";
import {
  CompactLocationField,
  LocationPickerSheet,
} from "@/components/location/LocationPickerSheet";
import { BookingTimeField } from "@/components/storefront/BookingTimeField";

type LocTarget = "start" | "end" | "stop" | null;

type Props = {
  day: DayPlan;
  previous: DayPlan | null;
  isFirst: boolean;
  isLast: boolean;
  onClose: () => void;
  onSave: (day: DayPlan) => void;
};

export function DayEditorSheet({
  day: initial,
  previous,
  isFirst,
  isLast,
  onClose,
  onSave,
}: Props) {
  const [day, setDay] = useState<DayPlan>(initial);
  const [locTarget, setLocTarget] = useState<LocTarget>(null);
  const [stopEditIndex, setStopEditIndex] = useState<number | null>(null);

  const inherited = Boolean(day.inheritStartFromPrevious && previous?.endLocation);
  const startDisplay = resolveDayStart(day, previous);

  function patch(partial: Partial<DayPlan>) {
    setDay((current) => ({ ...current, ...partial }));
  }

  function moveStop(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= day.stops.length) return;
    const stops = [...day.stops];
    const tmp = stops[index];
    stops[index] = stops[next];
    stops[next] = tmp;
    patch({ stops });
  }

  function onLocSelect(loc: StructuredLocation) {
    if (locTarget === "start") {
      patch({ startLocation: loc, inheritStartFromPrevious: false });
    } else if (locTarget === "end") {
      patch({ endLocation: loc });
    } else if (locTarget === "stop") {
      if (stopEditIndex != null) {
        const stops = [...day.stops];
        stops[stopEditIndex] = loc;
        patch({ stops });
      } else {
        patch({ stops: [...day.stops, loc] });
      }
    }
    setLocTarget(null);
    setStopEditIndex(null);
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[color:var(--store-paper,#F7F4EF)]">
      <header className="shrink-0 border-b border-[color:var(--store-line,#E8E2D8)] bg-[color:var(--store-primary,#0F3D3E)] px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <button type="button" onClick={onClose} className="text-sm text-white/80">
          ← กลับ
        </button>
        <h2 className="mt-2 text-lg font-semibold">วันที่ {day.dayNumber}</h2>
        <p className="text-xs text-white/70">{formatThaiShortDate(day.date)}</p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-28">
        <label className="flex items-start gap-3 rounded-2xl bg-white p-4">
          <input
            type="checkbox"
            checked={day.undecided}
            onChange={(e) => patch({ undecided: e.target.checked })}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold">ยังไม่ได้วางแผน</span>
            <span className="text-xs text-muted">ให้ร้านช่วยแนะนำวันนี้</span>
          </span>
        </label>

        {!day.undecided ? (
          <>
            <section className="space-y-2">
              <p className="text-xs font-medium text-muted">
                {isFirst ? "จุดรับเริ่มต้น *" : "เริ่มวันนี้ที่"}
              </p>
              {!isFirst ? (
                <label className="mb-2 flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={day.inheritStartFromPrevious}
                    onChange={(e) =>
                      patch({
                        inheritStartFromPrevious: e.target.checked,
                        startLocation: e.target.checked
                          ? previous?.endLocation ?? day.startLocation
                          : day.startLocation,
                      })
                    }
                  />
                  ต่อจากจุดจบของวันก่อน
                </label>
              ) : null}
              {inherited && startDisplay ? (
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-sm font-semibold">{startDisplay.label}</p>
                  {startDisplay.address ? (
                    <p className="mt-0.5 text-xs text-muted">{startDisplay.address}</p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
                    onClick={() => {
                      patch({ inheritStartFromPrevious: false });
                      setLocTarget("start");
                    }}
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <CompactLocationField
                  label=""
                  required={isFirst}
                  value={day.startLocation}
                  placeholder={isFirst ? "ค้นหาจุดรับเริ่มต้น" : "ค้นหาจุดเริ่มวันนี้"}
                  onOpen={() => setLocTarget("start")}
                />
              )}
              <BookingTimeField
                label={isFirst ? "เวลา" : "เวลาออก"}
                value={day.startTime}
                required={isFirst}
                onChange={(startTime) => patch({ startTime })}
              />
            </section>

            <section className="space-y-2">
              <p className="text-xs font-medium text-muted">จุดแวะ (ถ้ามี)</p>
              <ul className="space-y-2">
                {day.stops.map((stop, index) => (
                  <li
                    key={`${stop.label}-${index}`}
                    className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5"
                  >
                    <span className="text-muted" aria-hidden>
                      ≡
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {index + 1}. {stop.label}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-muted"
                      aria-label="เลื่อนขึ้น"
                      onClick={() => moveStop(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted"
                      aria-label="เลื่อนลง"
                      onClick={() => moveStop(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="text-xs text-danger"
                      onClick={() =>
                        patch({ stops: day.stops.filter((_, i) => i !== index) })
                      }
                    >
                      ลบ
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setStopEditIndex(null);
                  setLocTarget("stop");
                }}
                className="w-full rounded-2xl border border-dashed border-[color:var(--store-primary,#0F3D3E)]/30 bg-white py-3 text-sm font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
              >
                + เพิ่มจุดแวะ
              </button>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-medium text-muted">
                {isLast ? "จุดส่งสุดท้ายของทริป *" : "จบวันนี้ที่ / ที่พัก"}
              </p>
              {isLast ? (
                <p className="text-xs text-muted">นี่คือจุดส่งสุดท้ายของทั้งทริป ไม่ใช่แค่ที่พักรายวัน</p>
              ) : null}
              <CompactLocationField
                label=""
                required={isLast}
                value={day.endLocation}
                placeholder={isLast ? "ค้นหาจุดส่งสุดท้าย" : "ค้นหาที่พัก / จุดจบวัน"}
                onOpen={() => setLocTarget("end")}
              />
              {isLast ? (
                <BookingTimeField
                  label="เวลา"
                  value={day.endTime}
                  placeholder="—"
                  onChange={(endTime) => patch({ endTime })}
                />
              ) : null}
            </section>
          </>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted">หมายเหตุวันนี้ (ถ้ามี)</span>
          <textarea
            className="wizard-input min-h-[4.5rem] py-3"
            value={day.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="เช่น ต้องการเริ่มช้า / มีเด็กเล็ก"
          />
        </label>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-[color:var(--store-line,#E8E2D8)] bg-[color:var(--store-paper,#F7F4EF)]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          type="button"
          onClick={() => onSave(day)}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[color:var(--store-accent,#C4A35A)] text-sm font-semibold text-[#1a1510]"
        >
          บันทึกวันที่ {day.dayNumber}
        </button>
      </div>

      {locTarget ? (
        <LocationPickerSheet
          key={locTarget}
          open
          title={
            locTarget === "start"
              ? isFirst
                ? "จุดรับเริ่มต้น"
                : "เริ่มวันนี้ที่"
              : locTarget === "end"
                ? isLast
                  ? "จุดส่งสุดท้าย"
                  : "จบวันนี้ที่"
                : "เพิ่มจุดแวะ"
          }
          value={
            locTarget === "start"
              ? day.startLocation
              : locTarget === "end"
                ? day.endLocation
                : null
          }
          onClose={() => {
            setLocTarget(null);
            setStopEditIndex(null);
          }}
          onSelect={onLocSelect}
        />
      ) : null}
    </div>
  );
}
