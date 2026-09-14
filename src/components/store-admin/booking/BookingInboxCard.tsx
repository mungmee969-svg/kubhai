"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { buildOpsCardSummary, type OpsCardTone } from "@/lib/domain/booking-ops-next";
import type { Booking } from "@/lib/domain/types";

const READ_KEY = "kubhai.store.bookingRead";
const listeners = new Set<() => void>();

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

export function markBookingOpened(bookingId: string) {
  if (typeof window === "undefined") return;
  const map = readMap();
  map[bookingId] = new Date().toISOString();
  localStorage.setItem(READ_KEY, JSON.stringify(map));
  emit();
}

function isUnreadSnapshot(booking: Booking): boolean {
  if (booking.status !== "REQUESTED") return false;
  const map = readMap();
  const opened = map[booking.id];
  if (!opened) return true;
  return new Date(booking.updatedAt).getTime() > new Date(opened).getTime();
}

const TONE_CHIP: Record<OpsCardTone, string> = {
  attention: "bg-[color:var(--store-accent,#C4A35A)]/25 text-[color:var(--store-primary,#0F3D3E)]",
  wait: "bg-black/5 text-[color:var(--store-primary,#0F3D3E)]",
  ready: "bg-[color:var(--store-primary,#0F3D3E)]/10 text-[color:var(--store-primary,#0F3D3E)]",
  neutral: "bg-paper text-navy-800",
  done: "bg-line text-muted",
  danger: "bg-danger/10 text-danger",
};

export function BookingInboxCard({
  booking,
  attention,
  nextCtaLabel,
}: {
  booking: Booking;
  attention?: string | null;
  nextCtaLabel?: string | null;
}) {
  const summary = buildOpsCardSummary(booking, { attention, nextCtaLabel });
  const unread = useSyncExternalStore(
    subscribe,
    () => isUnreadSnapshot(booking),
    () => false,
  );

  return (
    <Link
      href={`/store/bookings/${booking.id}`}
      className={`block rounded-2xl border bg-white p-4 shadow-sm transition hover:border-[color:var(--store-primary,#0F3D3E)]/30 ${
        unread ? "border-[color:var(--store-accent,#C4A35A)]/50" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {unread ? (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--store-accent,#C4A35A)]" aria-label="ยังไม่ได้อ่าน" />
          ) : (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-transparent" />
          )}
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CHIP[summary.tone]}`}>
            {summary.statusLabel}
          </span>
        </div>
        <span className="text-xs text-muted">{summary.relativeTime}</span>
      </div>

      <p className="mt-3 text-xs font-medium tracking-wide text-muted">{booking.bookingCode}</p>
      <p className="mt-1 text-lg font-semibold text-[color:var(--store-primary,#0F3D3E)]">
        {booking.customerNameSnapshot}
      </p>
      <p className="mt-1 text-sm text-navy-800">
        {summary.dateRangeLabel} · {summary.durationLabel}
      </p>
      <p className="mt-1 text-sm text-muted">
        👤 {summary.passengersLabel}
        {summary.luggageLabel ? ` · 🧳 ${summary.luggageLabel}` : ""}
      </p>

      <div className="mt-3 text-sm">
        <p className="font-medium text-navy-800">{summary.routeFrom}</p>
        {summary.routeTo ? (
          <>
            <p className="my-0.5 text-muted">↓</p>
            <p className="font-medium text-navy-800">{summary.routeTo}</p>
          </>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-muted">{summary.serviceLabel}</p>

      {summary.attention ? (
        <p className="mt-3 rounded-xl bg-[color:var(--store-accent,#C4A35A)]/15 px-3 py-2 text-sm font-medium text-[color:var(--store-primary,#0F3D3E)]">
          ⚠ {summary.attention}
        </p>
      ) : null}

      <p className="mt-4 text-sm font-semibold text-[color:var(--store-primary,#0F3D3E)]">
        {summary.nextCtaLabel ? `${summary.nextCtaLabel} →` : "ดูและจัดการคำขอ →"}
      </p>
    </Link>
  );
}
