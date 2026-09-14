"use client";

import { useState } from "react";
import { DayCard } from "@/components/storefront/DayCard";
import { DayEditorSheet } from "@/components/storefront/DayEditorSheet";
import {
  buildDaysFromDuration,
  dayHasContent,
  derivedEndDate,
  formatThaiDateRange,
  formatThaiShortDate,
  STORE_HELP_INTERESTS,
  type DayPlan,
  type StoreHelpInterest,
} from "@/lib/booking/itinerary";

type Props = {
  startDate: string;
  numberOfDays: number;
  days: DayPlan[];
  letStorePlanTrip: boolean;
  storeHelpInterests: StoreHelpInterest[];
  onChange: (next: {
    startDate?: string;
    numberOfDays?: number;
    days?: DayPlan[];
    letStorePlanTrip?: boolean;
    storeHelpInterests?: StoreHelpInterest[];
    endDate?: string;
    multiDay?: boolean;
  }) => void;
};

export function MultiDayOverview({
  startDate,
  numberOfDays,
  days,
  letStorePlanTrip,
  storeHelpInterests,
  onChange,
}: Props) {
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [removeWarn, setRemoveWarn] = useState<DayPlan | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const safeDays =
    days.length === numberOfDays && startDate
      ? days
      : buildDaysFromDuration(startDate, numberOfDays, days);

  function setDuration(next: number) {
    const n = Math.max(1, Math.min(30, next));
    if (n < numberOfDays) {
      const removed = safeDays.slice(n);
      const populated = removed.find(dayHasContent);
      if (populated) {
        setRemoveWarn(populated);
        return;
      }
    }
    const built = buildDaysFromDuration(startDate, n, safeDays);
    onChange({
      numberOfDays: n,
      days: built,
      endDate: startDate ? derivedEndDate(startDate, n) : "",
      multiDay: true,
    });
  }

  function confirmRemove() {
    const n = Math.max(1, numberOfDays - 1);
    const built = buildDaysFromDuration(startDate, n, safeDays);
    onChange({
      numberOfDays: n,
      days: built,
      endDate: startDate ? derivedEndDate(startDate, n) : "",
    });
    setRemoveWarn(null);
  }

  function setStart(date: string) {
    const built = buildDaysFromDuration(date, numberOfDays, safeDays);
    onChange({
      startDate: date,
      days: built,
      endDate: date ? derivedEndDate(date, numberOfDays) : "",
    });
  }

  const editing = editingDay != null ? safeDays.find((d) => d.dayNumber === editingDay) : null;
  const editingIndex = editing ? safeDays.findIndex((d) => d.dayNumber === editing.dayNumber) : -1;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted">วันที่เริ่มต้น</span>
          <input
            type="date"
            className="wizard-input"
            value={startDate}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted">จำนวนวัน</span>
          <div className="flex h-12 items-center justify-between rounded-[1rem] bg-white px-2 shadow-sm">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--store-paper,#F7F4EF)] text-lg"
              onClick={() => setDuration(numberOfDays - 1)}
              aria-label="ลดจำนวนวัน"
            >
              −
            </button>
            <span className="text-base font-semibold">{numberOfDays}</span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--store-paper,#F7F4EF)] text-lg"
              onClick={() => setDuration(numberOfDays + 1)}
              aria-label="เพิ่มจำนวนวัน"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {startDate ? (
        <p className="rounded-2xl bg-[color:var(--store-primary-soft,#E7EFEA)] px-4 py-3 text-sm text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]">
          <span className="font-semibold">{formatThaiDateRange(startDate, numberOfDays)}</span>
          <span className="text-muted"> · {numberOfDays} วัน</span>
        </p>
      ) : null}

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted">แผนรายวัน — แต่ละวันไปไหนบ้าง</p>
        {safeDays.map((day, index) => (
          <DayCard
            key={day.dayNumber}
            day={day}
            previous={index > 0 ? safeDays[index - 1] : null}
            isFirst={index === 0}
            isLast={index === safeDays.length - 1}
            onEdit={() => setEditingDay(day.dayNumber)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDuration(numberOfDays + 1)}
        className="w-full rounded-2xl border border-dashed border-[color:var(--store-primary,#0F3D3E)]/25 bg-white/80 py-3 text-sm font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
      >
        + เพิ่มวัน
        {startDate ? ` (${formatThaiShortDate(derivedEndDate(startDate, numberOfDays + 1))})` : ""}
      </button>

      <div className="rounded-[1.25rem] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold">ยังไม่รู้ว่าจะไปไหน?</p>
        <p className="mt-1 text-xs text-muted">ไม่บังคับ — ร้านช่วยจัดทริปให้ได้</p>
        <button
          type="button"
          onClick={() => {
            onChange({ letStorePlanTrip: true });
            setHelpOpen(true);
          }}
          className={`mt-3 h-11 w-full rounded-2xl text-sm font-semibold ${
            letStorePlanTrip
              ? "bg-[color:var(--store-primary,#0F3D3E)] text-white"
              : "bg-[color:var(--store-paper,#F7F4EF)] text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
          }`}
        >
          ให้ร้านช่วยจัดทริป
        </button>
        {letStorePlanTrip && storeHelpInterests.length ? (
          <p className="mt-2 text-xs text-muted">สนใจ: {storeHelpInterests.join(" · ")}</p>
        ) : null}
      </div>

      {helpOpen ? (
        <StoreHelpSheet
          interests={storeHelpInterests}
          onClose={() => setHelpOpen(false)}
          onSave={(next) => {
            onChange({ letStorePlanTrip: true, storeHelpInterests: next });
            setHelpOpen(false);
          }}
        />
      ) : null}

      {removeWarn ? (
        <ConfirmRemoveDay
          day={removeWarn}
          onCancel={() => setRemoveWarn(null)}
          onConfirm={confirmRemove}
        />
      ) : null}

      {editing && editingIndex >= 0 ? (
        <DayEditorSheet
          key={`${editing.dayNumber}-${editing.date}-${editing.stops.length}`}
          day={editing}
          previous={editingIndex > 0 ? safeDays[editingIndex - 1] : null}
          isFirst={editingIndex === 0}
          isLast={editingIndex === safeDays.length - 1}
          onClose={() => setEditingDay(null)}
          onSave={(nextDay) => {
            const next = safeDays.map((d) => (d.dayNumber === nextDay.dayNumber ? nextDay : d));
            // Propagate end → next day start when inherited
            for (let i = 0; i < next.length - 1; i++) {
              if (next[i + 1].inheritStartFromPrevious && next[i].endLocation) {
                next[i + 1] = {
                  ...next[i + 1],
                  startLocation: next[i].endLocation,
                };
              }
            }
            onChange({ days: next });
            setEditingDay(null);
          }}
        />
      ) : null}
    </div>
  );
}

function StoreHelpSheet({
  interests,
  onClose,
  onSave,
}: {
  interests: StoreHelpInterest[];
  onClose: () => void;
  onSave: (next: StoreHelpInterest[]) => void;
}) {
  const [local, setLocal] = useState(interests);
  return (
    <div className="fixed inset-0 z-[65]">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="ปิด" />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-[color:var(--store-paper,#F7F4EF)] p-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">สิ่งที่สนใจ</h3>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            ปิด
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {STORE_HELP_INTERESTS.map((item) => {
            const on = local.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() =>
                  setLocal((current) =>
                    on ? current.filter((x) => x !== item) : [...current, item],
                  )
                }
                className={`rounded-full px-3 py-2 text-xs font-medium ${
                  on
                    ? "bg-[color:var(--store-primary,#0F3D3E)] text-white"
                    : "bg-white text-[color:var(--store-ink,#0F1724)]"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onSave(local)}
          className="mt-5 h-12 w-full rounded-2xl bg-[color:var(--store-accent,#C4A35A)] text-sm font-semibold text-[#1a1510]"
        >
          บันทึกความสนใจ
        </button>
      </div>
    </div>
  );
}

function ConfirmRemoveDay({
  day,
  onCancel,
  onConfirm,
}: {
  day: DayPlan;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5">
        <p className="text-sm font-semibold">วันที่ {day.dayNumber} มีข้อมูลการเดินทางอยู่</p>
        <p className="mt-2 text-sm text-muted">ต้องการลบหรือไม่? ข้อมูลจุดแวะของวันนี้จะหายไป</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="h-11 rounded-2xl bg-[color:var(--store-paper,#F7F4EF)] text-sm">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-2xl bg-[color:var(--store-primary,#0F3D3E)] text-sm font-semibold text-white"
          >
            ลบวัน
          </button>
        </div>
      </div>
    </div>
  );
}
