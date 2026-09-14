"use client";

import { useMemo, useState } from "react";
import { completeBookingAction } from "@/lib/actions/closeout";
import {
  EARLY_COMPLETION_LABELS,
  EARLY_COMPLETION_REASONS,
  type EarlyCompletionReason,
} from "@/lib/domain/customer-auth";
import {
  buildBookingCloseout,
  formatDurationMinutes,
  isEarlyCompletion,
  remainingScheduledDurationMs,
  scheduledEndIso,
} from "@/lib/domain/closeout";
import { formatMoney } from "@/lib/domain/ops";
import type { Booking, Driver, MoneyMovement, Vehicle } from "@/lib/domain/types";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 text-sm ${strong ? "font-semibold text-navy-800" : "text-navy-800"}`}>
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function JobCloseoutPanel({
  booking,
  movements,
  vehicle,
  driver,
  open,
  onClose,
  onDone,
}: {
  booking: Booking;
  movements: MoneyMovement[];
  vehicle: Vehicle | null;
  driver: Driver | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const closeout = useMemo(
    () => buildBookingCloseout(booking, movements, { vehicle }),
    [booking, movements, vehicle],
  );
  const early = isEarlyCompletion(booking);
  const [reason, setReason] = useState<EarlyCompletionReason | "">("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const outstanding = closeout.customerOutstanding ?? 0;
  const primaryLabel =
    outstanding > 0 ? `จบงานและเรียกเก็บ ฿${outstanding.toLocaleString("th-TH")}` : "ยืนยันจบงาน";

  async function submit(acknowledgeOutstanding: boolean) {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await completeBookingAction(booking.id, {
      earlyCompletionReason: early ? (reason as EarlyCompletionReason) || null : null,
      earlyCompletionNote: note || null,
      acknowledgeOutstanding,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-navy-800">จบงาน</h2>
            <p className="mt-1 text-sm text-muted">{booking.bookingCode}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            ปิด
          </button>
        </div>

        {early ? (
          <div className="mt-4 rounded-2xl border border-accent bg-accent/15 p-4">
            <p className="font-semibold text-navy-800">กำลังจบงานก่อนเวลาที่กำหนด</p>
            <p className="mt-2 text-sm text-navy-800">
              กำหนดจบ: {scheduledEndIso(booking) ? new Date(scheduledEndIso(booking)!).toLocaleString("th-TH") : "-"}
            </p>
            <p className="text-sm text-navy-800">ตอนนี้: {new Date().toLocaleString("th-TH")}</p>
            <p className="text-sm text-navy-800">
              เหลือตามตาราง: {formatDurationMinutes(remainingScheduledDurationMs(booking))}
            </p>
            <label className="mt-3 block text-sm font-medium text-navy-800">เหตุผล</label>
            <select
              className="admin-input mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value as EarlyCompletionReason | "")}
            >
              <option value="">เลือกเหตุผล</option>
              {EARLY_COMPLETION_REASONS.map((item) => (
                <option key={item} value={item}>
                  {EARLY_COMPLETION_LABELS[item]}
                </option>
              ))}
            </select>
            {reason === "OTHER" || reason ? (
              <textarea
                className="admin-input mt-2 min-h-20"
                placeholder={reason === "OTHER" ? "รายละเอียด (จำเป็น)" : "หมายเหตุ (ถ้ามี)"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            ) : null}
          </div>
        ) : null}

        <section className="mt-4 space-y-2 rounded-2xl bg-paper p-4">
          <Row label="ยอดงานทั้งหมด" value={formatMoney(closeout.acceptedQuotationTotal)} />
          <Row label="รับมัดจำแล้ว" value={formatMoney(closeout.depositReceived)} />
          <Row label="ยอดบริการรับเพิ่มแล้ว" value={formatMoney(closeout.serviceBalanceReceived)} />
          <div className="border-t border-line pt-2">
            <Row
              label="ยอดคงเหลือลูกค้า"
              value={formatMoney(closeout.customerOutstanding)}
              strong
            />
          </div>
          {outstanding > 0 ? (
            <p className="rounded-xl bg-accent/20 px-3 py-2 text-sm font-semibold text-navy-800">
              ยอดคงเหลือต้องรับ ฿{outstanding.toLocaleString("th-TH")}
            </p>
          ) : (
            <p className="text-sm font-medium text-success">✓ ชำระครบ</p>
          )}
        </section>

        <section className="mt-3 space-y-2 rounded-2xl bg-paper p-4">
          <Row
            label={vehicle?.ownershipType === "PARTNER" ? "ค่ารถ Partner" : "ค่าตัวคนขับ"}
            value={formatMoney(
              vehicle?.ownershipType === "PARTNER"
                ? closeout.partnerPayoutRequired
                : closeout.driverPayoutRequired,
            )}
          />
          <Row label="ทิป" value={formatMoney(closeout.tipReceived)} />
          <Row
            label="สถานะค่าตัว"
            value={
              (vehicle?.ownershipType === "PARTNER"
                ? closeout.partnerPayoutOutstanding
                : closeout.driverPayoutOutstanding) > 0
                ? "ยังไม่ได้จ่าย"
                : "จ่ายแล้ว"
            }
          />
          <Row
            label="สถานะทิป"
            value={closeout.tipPayoutOutstanding > 0 ? "รอโอน" : closeout.tipReceived > 0 ? "โอนแล้ว" : "-"}
          />
          {driver ? <p className="pt-1 text-xs text-muted">คนขับ: {driver.name}</p> : null}
        </section>

        <p className="mt-3 text-xs text-muted">
          จบงาน = สิ้นสุดงานเท่านั้น ไม่ปิดการเงินอัตโนมัติ · ใบเสนอราคาที่ยืนยันแล้วไม่ถูกปรับจากจบก่อนเวลา
        </p>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={pending || (early && !reason) || (early && reason === "OTHER" && !note.trim())}
            onClick={() => submit(outstanding > 0)}
            className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-50"
          >
            {pending ? "กำลังบันทึก..." : primaryLabel}
          </button>
          {outstanding > 0 ? (
            <button
              type="button"
              disabled={pending || (early && !reason)}
              onClick={() => submit(true)}
              className="h-11 rounded-xl border border-line px-4 text-sm text-navy-800 disabled:opacity-50"
            >
              ยังไม่ได้รับเงิน — จบงานและค้างชำระ
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="h-10 text-sm text-muted">
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
