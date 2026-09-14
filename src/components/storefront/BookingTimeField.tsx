"use client";

import { useEffect, useState } from "react";
import { normalizeClockTime } from "@/lib/booking/normalize";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function splitTime(value: string): { hour: string; minute: string } {
  const normalized = normalizeClockTime(value) ?? "09:00";
  const [hour, minute] = normalized.split(":");
  const roundedMinute = String((Math.round(Number(minute) / 5) * 5) % 60).padStart(2, "0");
  return { hour, minute: MINUTES.includes(minute) ? minute : roundedMinute };
}

/**
 * Touch-first booking time field.
 * Avoids broken opacity-0 native time inputs on mobile Safari/Chrome.
 * Stores canonical HH:MM via normalizeClockTime.
 */
export function BookingTimeField({
  label,
  value,
  onChange,
  required = false,
  placeholder = "เลือกเวลา",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const display = normalizeClockTime(value);

  return (
    <>
      <button
        type="button"
        className={`booking-datetime-card w-full text-left ${className}`}
        onClick={() => setOpen(true)}
        aria-label={label}
      >
        <span className="text-[11px] font-medium text-muted">
          {label}
          {required ? " *" : ""}
        </span>
        <p className="mt-1 text-sm font-semibold text-[color:var(--store-ink,#0F1724)]">
          {display || placeholder}
        </p>
        <p className="mt-0.5 text-[10px] text-muted">แตะเพื่อเปลี่ยนเวลา</p>
      </button>
      {open ? (
        <BookingTimeSheet
          key={`${display || "empty"}-open`}
          label={label}
          value={display || "09:00"}
          onClose={() => setOpen(false)}
          onConfirm={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function BookingTimeSheet({
  label,
  value,
  onClose,
  onConfirm,
}: {
  label: string;
  value: string;
  onClose: () => void;
  onConfirm: (next: string) => void;
}) {
  const initial = splitTime(value);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preview = `${hour}:${minute}`;

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" className="absolute inset-0 bg-navy-950/45" aria-label="ปิด" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-y-auto sm:bottom-8 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-navy-800">{label}</p>
            <p className="text-xs text-muted">เลือกชั่วโมงและนาที</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 rounded-full bg-paper px-3 text-sm">
            ปิด
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="text-center text-3xl font-semibold tabular-nums tracking-tight text-navy-800">
            {preview}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="mb-2 text-center text-[11px] font-medium text-muted">ชั่วโมง</p>
              <div className="max-h-52 overflow-y-auto rounded-2xl bg-paper p-1.5 scrollbar-none">
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {HOURS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setHour(item)}
                      className={`h-11 rounded-xl text-sm font-semibold tabular-nums ${
                        hour === item
                          ? "bg-[color:var(--store-primary,#0F3D3E)] text-white"
                          : "bg-white text-navy-800"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-center text-[11px] font-medium text-muted">นาที</p>
              <div className="max-h-52 overflow-y-auto rounded-2xl bg-paper p-1.5 scrollbar-none">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {MINUTES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMinute(item)}
                      className={`h-11 rounded-xl text-sm font-semibold tabular-nums ${
                        minute === item
                          ? "bg-[color:var(--store-primary,#0F3D3E)] text-white"
                          : "bg-white text-navy-800"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-line px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              const next = normalizeClockTime(preview);
              if (!next) return;
              onConfirm(next);
            }}
            className="cx-accent-cta flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold"
          >
            ใช้เวลา {preview}
          </button>
        </div>
      </div>
    </div>
  );
}
