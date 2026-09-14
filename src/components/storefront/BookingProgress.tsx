"use client";

import type { BookingWizardStep } from "@/lib/booking/draft";
import { BOOKING_WIZARD_MAX_STEP } from "@/lib/booking/draft";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";

const STEP_KEYS = [
  "booking.step.1",
  "booking.step.2",
  "booking.step.3",
  "booking.step.4",
  "booking.step.5",
] as const;

/** @deprecated Thai labels for scripts/quick-booking-check — prefer booking.step.* via t() */
export const BOOKING_CARD_LABELS = [
  "เลือกรูปแบบการเดินทาง",
  "รายละเอียดการเดินทาง",
  "ผู้โดยสารและรถ",
  "ข้อมูลผู้จอง",
  "ตรวจสอบและส่งคำขอจอง",
] as const;

export function BookingProgress({
  step,
  variant = "sheet",
  maxStep = BOOKING_WIZARD_MAX_STEP,
}: {
  step: BookingWizardStep;
  variant?: "hero" | "sheet";
  maxStep?: number;
}) {
  const { t } = useCustomerPrefs();
  const onSheet = variant === "sheet";
  const total = Math.max(1, Math.min(6, maxStep));
  const pct = ((step - 1) / Math.max(1, total - 1)) * 100;
  const label = t(STEP_KEYS[step - 1] ?? "booking.step.1");

  return (
    <div
      className="w-full space-y-2"
      aria-label={t("booking.progress", { current: step, total })}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={`text-[11px] font-semibold tracking-wide ${
            onSheet ? "text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]" : "text-white"
          }`}
        >
          {step} / {total}
        </p>
        <p
          className={`min-w-0 truncate text-right text-xs font-medium ${
            onSheet
              ? "text-[color:var(--cx-textPrimary,var(--store-ink,#0F1724))]"
              : "text-white/90"
          }`}
        >
          {label}
        </p>
      </div>
      <div
        className={`h-1.5 w-full overflow-hidden rounded-full ${
          onSheet ? "bg-black/[0.08] dark:bg-white/15" : "bg-white/20"
        }`}
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full bg-[color:var(--store-accent,#C4A35A)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${Math.max(10, pct)}%` }}
        />
      </div>
    </div>
  );
}
