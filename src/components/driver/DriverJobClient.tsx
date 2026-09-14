"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  endDriverDayAction,
  startDriverDayAction,
  submitDriverSuggestionAction,
} from "@/lib/actions/driver-job";
import {
  DRIVER_DAY_STATUS_LABEL,
  formatElapsed,
  formatTimeTh,
  resolveDayWorkStatus,
  type DriverDayStatus,
} from "@/lib/domain/driver-job";
import type { DriverDayWorkLog } from "@/lib/domain/types";

type DayRow = {
  dayNumber: number;
  dayDate: string;
  relativeLabel: string;
  log: DriverDayWorkLog | null;
};

export function DriverJobClient({
  token,
  days,
}: {
  token: string;
  days: DayRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [suggestDay, setSuggestDay] = useState<number | "">("");

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMessage: string) {
    if (pending) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(okMessage);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</p>
      ) : null}

      <section className="space-y-3">
        {days.map((day) => {
          const status = resolveDayWorkStatus(day.log);
          return (
            <DayCard
              key={day.dayNumber}
              day={day}
              status={status}
              pending={pending}
              onStart={() =>
                run(() => startDriverDayAction(token, day.dayNumber), `เริ่มวันที่ ${day.dayNumber} แล้ว`)
              }
              onEnd={() =>
                run(() => endDriverDayAction(token, day.dayNumber), `จบวันที่ ${day.dayNumber} แล้ว`)
              }
            />
          );
        })}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[color:var(--store-text,#0F172A)]">เสนอแนะเส้นทาง</h2>
        <p className="mt-1 text-xs text-muted">
          ข้อเสนอจะส่งให้ร้านพิจารณา — ไม่แก้แผนทริปอัตโนมัติ
        </p>
        <select
          className="mt-3 h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm"
          value={suggestDay}
          onChange={(e) =>
            setSuggestDay(e.target.value ? Number(e.target.value) : "")
          }
        >
          <option value="">ทั้งทริป / ไม่ระบุวัน</option>
          {days.map((day) => (
            <option key={day.dayNumber} value={day.dayNumber}>
              วันที่ {day.dayNumber}
            </option>
          ))}
        </select>
        <textarea
          className="mt-2 min-h-24 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          placeholder="เช่น แนะนำเลี่ยงเส้นทางช่วงบ่ายเพราะรถติด"
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
        />
        <button
          type="button"
          disabled={pending || !suggestion.trim()}
          onClick={() =>
            run(async () => {
              const result = await submitDriverSuggestionAction(token, {
                body: suggestion,
                dayNumber: suggestDay === "" ? null : suggestDay,
              });
              if (result.ok) setSuggestion("");
              return result;
            }, "ส่งข้อเสนอแนะแล้ว")
          }
          className="mt-2 h-11 w-full rounded-xl bg-[color:var(--store-primary,#0F3D3E)] text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "กำลังส่ง..." : "ส่งข้อเสนอแนะ"}
        </button>
      </section>
    </div>
  );
}

function DayCard({
  day,
  status,
  pending,
  onStart,
  onEnd,
}: {
  day: DayRow;
  status: DriverDayStatus;
  pending: boolean;
  onStart: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[color:var(--store-text,#0F172A)]">
            วันที่ {day.dayNumber}
            {day.relativeLabel ? (
              <span className="ml-2 text-xs font-medium text-[color:var(--store-accent,#C4A35A)]">
                {day.relativeLabel}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted">{day.dayDate}</p>
        </div>
        <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium">
          {DRIVER_DAY_STATUS_LABEL[status]}
        </span>
      </div>
      {day.log?.startedAt ? (
        <p className="mt-2 text-xs text-muted">
          เริ่ม {formatTimeTh(day.log.startedAt)}
          {day.log.endedAt
            ? ` · จบ ${formatTimeTh(day.log.endedAt)}${
                day.log.elapsedMinutes != null
                  ? ` · ${formatElapsed(day.log.elapsedMinutes)}`
                  : ""
              }`
            : ""}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        {status === "NOT_STARTED" ? (
          <button
            type="button"
            disabled={pending}
            onClick={onStart}
            className="h-11 flex-1 rounded-xl bg-[color:var(--store-primary,#0F3D3E)] text-sm font-semibold text-white disabled:opacity-60"
          >
            เริ่มงานวันนี้
          </button>
        ) : null}
        {status === "ACTIVE" ? (
          <button
            type="button"
            disabled={pending}
            onClick={onEnd}
            className="h-11 flex-1 rounded-xl bg-[color:var(--store-accent,#C4A35A)] text-sm font-semibold text-navy-950 disabled:opacity-60"
          >
            จบงานวันนี้
          </button>
        ) : null}
      </div>
    </div>
  );
}
