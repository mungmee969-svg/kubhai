"use client";

import { useMemo, useState } from "react";
import { Feedback } from "@/components/store-admin/ui/Feedback";
import {
  sendQuotationAction,
  updateQuotationDraftAction,
} from "@/lib/actions/quotation";
import { composeOvertimeTerms } from "@/lib/domain/booking-ops-next";
import { formatDuration } from "@/lib/domain/fleet";
import { formatMoney, formatThaiDate } from "@/lib/domain/ops";
import { calculateQuotationTotals, DEFAULT_QUOTATION_TERMS } from "@/lib/domain/quotation";
import type { QuotationRecord } from "@/lib/data/repository";
import type { Booking, Driver, Vehicle } from "@/lib/domain/types";
import type { QuotationItemType } from "@/lib/domain/enums";

type Extra = { description: string; unitPrice: string; note: string };

export function StoreOfferForm({
  quote,
  booking,
  vehicle,
  driver,
  onClose,
  onSaved,
}: {
  quote: QuotationRecord;
  booking: Booking;
  vehicle?: Vehicle | null;
  driver?: Driver | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const serviceLine = quote.items.find((item) => item.type === "VEHICLE_SERVICE") ?? quote.items[0];
  const initialExtras = quote.items
    .filter((item) => item.type !== "VEHICLE_SERVICE" && item.type !== "DISCOUNT")
    .map((item) => ({
      description: item.description,
      unitPrice: String(item.unitPrice),
      note: item.note ?? "",
    }));

  const [serviceAmount, setServiceAmount] = useState(String(serviceLine?.unitPrice ?? ""));
  const [deposit, setDeposit] = useState(
    quote.depositType === "NONE" ? "" : String(quote.depositValue || quote.depositRequiredAmount || ""),
  );
  const [hours, setHours] = useState(
    quote.includedHoursPerDay != null ? String(quote.includedHoursPerDay) : "",
  );
  const [otRate, setOtRate] = useState(
    quote.overtimeRatePerHour != null ? String(quote.overtimeRatePerHour) : "",
  );
  const [extras, setExtras] = useState<Extra[]>(initialExtras);
  const [termsBase, setTermsBase] = useState(quote.terms ?? DEFAULT_QUOTATION_TERMS);
  const [note, setNote] = useState(quote.note ?? "");
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => {
    const lines: {
      type: QuotationItemType;
      description: string;
      quantity: number;
      unitPrice: number;
      note: string | null;
    }[] = [
      {
        type: "VEHICLE_SERVICE",
        description: serviceLine?.description ?? "ค่าบริการ",
        quantity: 1,
        unitPrice: Number(serviceAmount || 0),
        note: null,
      },
    ];
    for (const extra of extras) {
      if (!extra.description.trim()) continue;
      lines.push({
        type: "CUSTOM",
        description: extra.description.trim(),
        quantity: 1,
        unitPrice: Number(extra.unitPrice || 0),
        note: extra.note || null,
      });
    }
    return lines;
  }, [serviceAmount, extras, serviceLine?.description]);

  const includedHoursPerDay = hours === "" ? null : Number(hours);
  const overtimeRatePerHour = otRate === "" ? null : Number(otRate);
  const depositValue = Number(deposit || 0);
  const depositType = depositValue > 0 ? ("FIXED_AMOUNT" as const) : ("NONE" as const);

  const totals = useMemo(() => {
    try {
      return calculateQuotationTotals(items, 0, depositType, depositValue);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "ยอดไม่ถูกต้อง" };
    }
  }, [items, depositType, depositValue]);

  const composedTerms = composeOvertimeTerms(termsBase, includedHoursPerDay, overtimeRatePerHour);

  function payload() {
    return {
      items,
      discountAmount: 0,
      depositType,
      depositValue,
      note: note || null,
      terms: composedTerms || null,
      includedHoursPerDay,
      overtimeRatePerHour,
      validUntil: quote.validUntil,
    };
  }

  async function save(send: boolean) {
    if (pending) return;
    setPending(true);
    setError(null);
    const saved = await updateQuotationDraftAction(quote.id, booking.id, payload());
    if (!saved.ok) {
      setPending(false);
      setError(saved.error);
      return;
    }
    if (!send) {
      setPending(false);
      onSaved("บันทึกแล้ว");
      return;
    }
    const sent = await sendQuotationAction(quote.id, booking.id);
    setPending(false);
    if (!sent.ok) {
      setError(sent.error);
      return;
    }
    onSaved("ส่งข้อเสนอให้ลูกค้าแล้ว");
  }

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-navy-950/40" onClick={onClose} aria-label="ปิด" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--store-primary,#0F3D3E)]">
              {preview ? "ตัวอย่างข้อเสนอ" : "ข้อเสนอราคา"}
            </h2>
            <p className="text-xs text-muted">
              {quote.quotationNumber} · ฉบับที่ {quote.version}
            </p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-muted">
            ปิด
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 pb-36">
          <Feedback error={error} />

          {preview ? (
            <div className="space-y-3 rounded-2xl border border-line p-4">
              <p className="text-sm font-semibold text-navy-800">ข้อเสนอสำหรับลูกค้า</p>
              <p className="text-sm">
                {formatThaiDate(booking.startDate)}
                {booking.endDate && booking.endDate !== booking.startDate
                  ? ` – ${formatThaiDate(booking.endDate)}`
                  : ""}{" "}
                · {formatDuration(booking)}
              </p>
              {vehicle ? (
                <p className="text-sm">
                  {vehicle.brand} {vehicle.model}
                  {driver ? ` · คนขับ: ${driver.name}` : ""}
                </p>
              ) : (
                <p className="text-sm text-muted">ให้ร้านเลือกรถที่เหมาะให้</p>
              )}
              {"error" in totals ? (
                <p className="text-sm text-danger">{totals.error}</p>
              ) : (
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt>ค่าบริการ</dt>
                    <dd className="font-semibold">{formatMoney(totals.totalAmount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>มัดจำ</dt>
                    <dd>{formatMoney(totals.depositRequiredAmount)}</dd>
                  </div>
                </dl>
              )}
              {(includedHoursPerDay || overtimeRatePerHour) && (
                <div className="rounded-xl bg-paper px-3 py-2 text-sm">
                  <p className="font-medium">เงื่อนไขเวลา</p>
                  {includedHoursPerDay != null ? <p>รวม {includedHoursPerDay} ชม./วัน</p> : null}
                  {overtimeRatePerHour != null ? (
                    <p>OT {formatMoney(overtimeRatePerHour)}/ชม.</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted">ยังไม่ใช่ยอดเรียกเก็บ — คิดตามเวลาใช้งานจริงหลังจบงาน</p>
                </div>
              )}
              {extras.filter((item) => item.description.trim()).length ? (
                <ul className="text-sm">
                  {extras
                    .filter((item) => item.description.trim())
                    .map((item, index) => (
                      <li key={index} className="flex justify-between gap-2">
                        <span>{item.description}</span>
                        <span>{formatMoney(Number(item.unitPrice || 0))}</span>
                      </li>
                    ))}
                </ul>
              ) : null}
              {composedTerms ? (
                <p className="whitespace-pre-wrap text-xs text-muted">{composedTerms}</p>
              ) : null}
            </div>
          ) : (
            <>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">ค่าบริการ (บาท)</span>
                <input
                  className="admin-input text-lg font-semibold"
                  inputMode="decimal"
                  value={serviceAmount}
                  onChange={(e) => setServiceAmount(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">มัดจำ (บาท)</span>
                <input
                  className="admin-input"
                  inputMode="decimal"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder="0 = ไม่มัดจำ"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">รวมเวลา (ชม./วัน)</span>
                  <input
                    className="admin-input"
                    inputMode="decimal"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="8"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">OT (บาท/ชม.)</span>
                  <input
                    className="admin-input"
                    inputMode="decimal"
                    value={otRate}
                    onChange={(e) => setOtRate(e.target.value)}
                    placeholder="200"
                  />
                </label>
              </div>
              <p className="text-xs text-muted">
                OT เป็นเงื่อนไขในใบเสนอราคาเท่านั้น — ไม่สร้างยอดค้างชำระจนกว่าจะบันทึกหลังจบงาน
              </p>

              <div className="space-y-2">
                <p className="text-sm font-medium text-navy-800">รายการเพิ่มเติม</p>
                {extras.map((item, index) => (
                  <div key={index} className="grid gap-2 rounded-2xl bg-paper p-3">
                    <input
                      className="admin-input"
                      placeholder="เช่น ค่าทางด่วน / ที่จอด"
                      value={item.description}
                      onChange={(e) =>
                        setExtras((current) =>
                          current.map((row, i) => (i === index ? { ...row, description: e.target.value } : row)),
                        )
                      }
                    />
                    <input
                      className="admin-input"
                      inputMode="decimal"
                      placeholder="จำนวนเงิน"
                      value={item.unitPrice}
                      onChange={(e) =>
                        setExtras((current) =>
                          current.map((row, i) => (i === index ? { ...row, unitPrice: e.target.value } : row)),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="text-left text-xs text-danger"
                      onClick={() => setExtras((current) => current.filter((_, i) => i !== index))}
                    >
                      ลบรายการ
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="h-10 rounded-xl bg-paper px-4 text-sm"
                  onClick={() => setExtras((current) => [...current, { description: "", unitPrice: "", note: "" }])}
                >
                  + เพิ่มรายการ
                </button>
              </div>

              <textarea
                className="admin-input min-h-20 py-3"
                placeholder="เงื่อนไขเพิ่มเติม"
                value={termsBase}
                onChange={(e) => setTermsBase(e.target.value)}
              />
              <textarea
                className="admin-input min-h-16 py-3"
                placeholder="หมายเหตุถึงลูกค้า"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              {"error" in totals ? (
                <p className="text-sm text-danger">{totals.error}</p>
              ) : (
                <dl className="rounded-2xl bg-paper p-4 text-sm">
                  <div className="flex justify-between">
                    <dt>ยอดรวม</dt>
                    <dd className="font-semibold">{formatMoney(totals.totalAmount)}</dd>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <dt className="text-muted">มัดจำ</dt>
                    <dd>{formatMoney(totals.depositRequiredAmount)}</dd>
                  </div>
                </dl>
              )}
            </>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 space-y-2 border-t border-line bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {preview ? (
            <>
              <button
                type="button"
                disabled={pending || "error" in totals}
                onClick={() => save(true)}
                className="ui-press h-12 w-full rounded-xl bg-[color:var(--store-accent,#C4A35A)] text-sm font-semibold text-navy-950 disabled:opacity-50"
              >
                {pending ? "กำลังส่ง..." : "ส่งข้อเสนอให้ลูกค้า"}
              </button>
              <button
                type="button"
                onClick={() => setPreview(false)}
                className="ui-press h-11 w-full rounded-xl bg-paper text-sm"
              >
                กลับไปแก้
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={pending || "error" in totals || Number(serviceAmount || 0) <= 0}
                onClick={() => save(true)}
                className="ui-press h-12 w-full rounded-xl bg-[color:var(--store-accent,#C4A35A)] text-sm font-semibold text-navy-950 disabled:opacity-50"
              >
                {pending ? "กำลังส่ง..." : "ส่งข้อเสนอให้ลูกค้า"}
              </button>
              <button
                type="button"
                disabled={pending || "error" in totals || Number(serviceAmount || 0) <= 0}
                onClick={() => setPreview(true)}
                className="ui-press h-11 w-full rounded-xl border border-line bg-white text-sm text-navy-800 disabled:opacity-50"
              >
                ดูตัวอย่างข้อเสนอ
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
