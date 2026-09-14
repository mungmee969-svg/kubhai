"use client";

import { useState, useTransition } from "react";
import { updateBookingStatusAction } from "@/lib/actions/store";
import { formatMoney, formatThaiDate } from "@/lib/domain/ops";
import type { Booking } from "@/lib/domain/types";

export function CancelBookingSheet({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasDeposit =
    (booking.depositAmount ?? 0) > 0 ||
    booking.paidAmount > 0 ||
    booking.status === "CONFIRMED" ||
    booking.status === "IN_PROGRESS" ||
    booking.status === "WAITING_DEPOSIT" ||
    booking.status === "COMPLETED";

  const started = Boolean(booking.actualStartAt) || booking.status === "IN_PROGRESS";

  function submit() {
    if (!reason.trim()) {
      setError("กรุณาระบุเหตุผล");
      return;
    }
    if (!confirmed) {
      setError("กรุณายืนยันการยกเลิก");
      return;
    }
    startTransition(async () => {
      const result = await updateBookingStatusAction(booking.id, "CANCELLED", {
        reason: reason.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-navy-950/40" onClick={onClose} aria-label="ปิด" />
      <div className="absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-y-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <h2 className="text-lg font-semibold text-navy-800">ยกเลิกงาน</h2>
        <p className="mt-1 text-sm text-muted">
          {booking.bookingCode} · {booking.customerNameSnapshot} · {formatThaiDate(booking.startDate)}{" "}
          {booking.startTime ?? ""}
        </p>

        <ul className="mt-4 space-y-1.5 rounded-2xl bg-paper p-3 text-sm text-navy-800">
          <li>
            สถานะปัจจุบัน: <strong>{booking.status}</strong>
          </li>
          <li>
            มัดจำที่ตั้งไว้: {formatMoney(booking.depositAmount ?? 0)}
            {booking.paidAmount > 0 ? ` · รับแล้ว ${formatMoney(booking.paidAmount)}` : ""}
          </li>
          <li>รถ: {booking.assignedVehicleId ? "มีจัดรถแล้ว" : "ยังไม่ได้จัดรถ"}</li>
          <li>คนขับ: {booking.assignedDriverId ? "มีจัดคนขับแล้ว" : "ยังไม่ได้จัดคนขับ"}</li>
          <li>เริ่มบริการแล้ว: {started ? "ใช่" : "ยังไม่"}</li>
        </ul>

        {hasDeposit ? (
          <p className="mt-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-deep">
            มีมัดจำ/เงินลูกค้าเกี่ยวข้อง — ระบบจะไม่ลบประวัติการเงินอัตโนมัติ
            การคืนเงินต้องจัดการแยกตามความจริงทางการเงินของร้าน
          </p>
        ) : null}

        <label className="mt-4 block text-sm">
          เหตุผลยกเลิก
          <textarea
            className="admin-input mt-1 min-h-24 w-full py-3"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ระบุเหตุผลให้ชัดเจน"
          />
        </label>

        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            ยืนยันยกเลิกงานนี้ — จะปล่อยคิวรถ/คนขับและเพิกถอนลิงก์คนขับ (ถ้ามี)
            แต่เก็บประวัติ Booking / การชำระเงิน / ใบเสนอราคาไว้
          </span>
        </label>

        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="ui-press h-11 flex-1 rounded-xl bg-paper text-sm"
          >
            กลับ
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="ui-press h-11 flex-1 rounded-xl bg-danger text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
          </button>
        </div>
      </div>
    </div>
  );
}
