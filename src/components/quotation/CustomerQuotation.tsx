"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuotationDocument } from "@/components/quotation/QuotationDocument";
import {
  acceptQuotationAction,
  rejectQuotationAction,
  requestQuotationChangeAction,
} from "@/lib/actions/quotation";
import { effectiveQuotationStatus } from "@/lib/domain/quotation";
import type { QuotationRecord } from "@/lib/data/repository";
import type { Booking, Business, Customer } from "@/lib/domain/types";

const CHANGE_HINTS = ["เปลี่ยนรถ", "ลดจำนวนวัน", "เปลี่ยนเวลา", "ขอปรับราคา", "อื่นๆ"];

export function CustomerQuotation({
  token,
  quotation,
  booking,
  business,
  customer,
  itinerary = [],
  customerTips = [],
}: {
  token: string;
  quotation: QuotationRecord;
  booking: Booking;
  business: Business;
  customer: Customer | null;
  itinerary?: import("@/lib/domain/types").BookingItineraryItem[];
  customerTips?: import("@/lib/domain/types").BookingNote[];
}) {
  const router = useRouter();
  const status = effectiveQuotationStatus(quotation);
  const expired = status === "EXPIRED";
  const actionable = status === "SENT" && !expired;
  const [mode, setMode] = useState<"idle" | "accept" | "change" | "reject">("idle");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode("idle");
    router.refresh();
  }

  return (
    <section className="rounded-3xl bg-white p-5">
      {expired ? (
        <p className="mb-4 rounded-2xl bg-paper px-3 py-2 text-sm font-medium text-danger">ใบเสนอราคาหมดอายุ</p>
      ) : null}
      {status === "CUSTOMER_ACCEPTED" ? (
        <p className="mb-4 rounded-2xl bg-success/15 px-3 py-2 text-sm font-medium text-success">ยืนยันใบเสนอราคาแล้ว</p>
      ) : null}
      {status === "CUSTOMER_CHANGE_REQUESTED" ? (
        <p className="mb-4 rounded-2xl bg-accent/20 px-3 py-2 text-sm">ส่งคำขอแก้ไขแล้ว ร้านกำลังจัดทำฉบับใหม่</p>
      ) : null}
      {status === "CUSTOMER_REJECTED" ? (
        <p className="mb-4 rounded-2xl bg-paper px-3 py-2 text-sm">ปฏิเสธใบเสนอราคานี้แล้ว</p>
      ) : null}

      <QuotationDocument
        quotation={quotation}
        booking={booking}
        business={business}
        customer={customer}
        itinerary={itinerary}
        customerTips={customerTips}
      />

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {actionable ? (
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            className="h-12 rounded-2xl bg-store text-sm font-semibold text-white"
            onClick={() => setMode("accept")}
          >
            ยืนยันใบเสนอราคา
          </button>
          <button type="button" className="h-12 rounded-2xl bg-paper text-sm font-semibold" onClick={() => setMode("change")}>
            ขอแก้ไข
          </button>
          <button type="button" className="h-12 rounded-2xl bg-white text-sm text-danger" onClick={() => setMode("reject")}>
            ปฏิเสธ
          </button>
        </div>
      ) : null}

      {mode === "accept" ? (
        <ConfirmBox
          title="ยืนยันใบเสนอราคานี้?"
          pending={pending}
          onCancel={() => setMode("idle")}
          onConfirm={() => run(() => acceptQuotationAction(token, quotation.id))}
        >
          <p className="text-sm">ยอดรวมและมัดจำจะกลายเป็นราคางานที่ใช้จริง การยืนยันยังไม่ถือว่าชำระเงิน</p>
        </ConfirmBox>
      ) : null}

      {mode === "change" ? (
        <ConfirmBox
          title="ต้องการแก้ไขอะไร"
          pending={pending}
          confirmLabel="ส่งคำขอแก้ไข"
          onCancel={() => setMode("idle")}
          onConfirm={() => run(() => requestQuotationChangeAction(token, quotation.id, text))}
        >
          <div className="flex flex-wrap gap-2">
            {CHANGE_HINTS.map((hint) => (
              <button key={hint} type="button" className="rounded-full bg-paper px-3 py-1 text-xs" onClick={() => setText(hint)}>
                {hint}
              </button>
            ))}
          </div>
          <textarea className="admin-input mt-2 min-h-24 py-3" value={text} onChange={(e) => setText(e.target.value)} />
        </ConfirmBox>
      ) : null}

      {mode === "reject" ? (
        <ConfirmBox
          title="ปฏิเสธใบเสนอราคานี้?"
          pending={pending}
          confirmLabel="ปฏิเสธ"
          onCancel={() => setMode("idle")}
          onConfirm={() => run(() => rejectQuotationAction(token, quotation.id, text || null))}
        >
          <textarea
            className="admin-input min-h-24 py-3"
            placeholder="เหตุผล (ถ้ามี)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </ConfirmBox>
      ) : null}
    </section>
  );
}

function ConfirmBox({
  title,
  pending,
  confirmLabel = "ยืนยัน",
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  pending: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-paper p-4">
      <p className="font-medium">{title}</p>
      <div className="mt-2">{children}</div>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={pending} onClick={onConfirm} className="h-11 rounded-xl bg-store px-4 text-sm font-semibold text-white disabled:opacity-60">
          {confirmLabel}
        </button>
        <button type="button" disabled={pending} onClick={onCancel} className="h-11 rounded-xl bg-white px-4 text-sm">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
