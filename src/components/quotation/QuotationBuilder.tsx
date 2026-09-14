"use client";

import { useMemo, useState } from "react";
import { Feedback } from "@/components/store-admin/ui/Feedback";
import {
  cancelQuotationAction,
  sendQuotationAction,
  updateQuotationDraftAction,
} from "@/lib/actions/quotation";
import { QUOTATION_ITEM_TYPES, type QuotationDepositType, type QuotationItemType } from "@/lib/domain/enums";
import {
  QUOTATION_ITEM_LABEL,
  QUOTATION_TEMPLATES,
  calculateQuotationTotals,
  lineAmount,
} from "@/lib/domain/quotation";
import { composeOvertimeTerms } from "@/lib/domain/booking-ops-next";
import { formatMoney } from "@/lib/domain/ops";
import type { QuotationRecord } from "@/lib/data/repository";

type Line = {
  id?: string;
  type: QuotationItemType;
  description: string;
  quantity: string;
  unitPrice: string;
  note: string;
};

function toLines(quote: QuotationRecord): Line[] {
  return quote.items.length
    ? quote.items.map((item) => ({
        id: item.id,
        type: item.type,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        note: item.note ?? "",
      }))
    : [{ type: "VEHICLE_SERVICE", description: "ค่ารถ / ค่าบริการ", quantity: "1", unitPrice: "0", note: "" }];
}

export function QuotationBuilder({
  quote,
  bookingId,
  onClose,
  onSaved,
}: {
  quote: QuotationRecord;
  bookingId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [lines, setLines] = useState<Line[]>(() => toLines(quote));
  const [discount, setDiscount] = useState(String(quote.discountAmount || ""));
  const [depositType, setDepositType] = useState<QuotationDepositType>(quote.depositType);
  const [depositValue, setDepositValue] = useState(String(quote.depositValue || ""));
  const [note, setNote] = useState(quote.note ?? "");
  const [terms, setTerms] = useState(quote.terms ?? "");
  const [hours, setHours] = useState(quote.includedHoursPerDay != null ? String(quote.includedHoursPerDay) : "");
  const [otRate, setOtRate] = useState(quote.overtimeRatePerHour != null ? String(quote.overtimeRatePerHour) : "");
  const [validUntil, setValidUntil] = useState(quote.validUntil ? quote.validUntil.slice(0, 16) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(
    () =>
      lines.map((line) => ({
        id: line.id,
        type: line.type,
        description: line.description,
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        note: line.note || null,
      })),
    [lines],
  );

  const totals = useMemo(() => {
    try {
      return calculateQuotationTotals(parsed, Number(discount || 0), depositType, Number(depositValue || 0));
    } catch (err) {
      return { error: err instanceof Error ? err.message : "ยอดไม่ถูกต้อง" };
    }
  }, [parsed, discount, depositType, depositValue]);

  function payload() {
    const includedHoursPerDay = hours === "" ? null : Number(hours);
    const overtimeRatePerHour = otRate === "" ? null : Number(otRate);
    return {
      items: parsed,
      discountAmount: Number(discount || 0),
      depositType,
      depositValue: Number(depositValue || 0),
      note: note || null,
      terms: composeOvertimeTerms(terms, includedHoursPerDay, overtimeRatePerHour) || null,
      includedHoursPerDay,
      overtimeRatePerHour,
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
    };
  }

  async function save(send: boolean) {
    if (pending) return;
    setPending(true);
    setError(null);
    const saved = await updateQuotationDraftAction(quote.id, bookingId, payload());
    if (!saved.ok) {
      setPending(false);
      setError(saved.error);
      return;
    }
    if (!send) {
      setPending(false);
      onSaved("บันทึกร่างแล้ว");
      return;
    }
    const sent = await sendQuotationAction(quote.id, bookingId);
    setPending(false);
    if (!sent.ok) {
      setError(sent.error);
      return;
    }
    onSaved("ส่งใบเสนอราคาให้ลูกค้าแล้ว");
  }

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-navy-950/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-navy-800">สร้างใบเสนอราคา</h2>
            <p className="text-xs text-muted">
              {quote.quotationNumber} · ฉบับที่ {quote.version}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            ปิด
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Feedback error={error} />
          <div className="flex flex-wrap gap-2">
            {QUOTATION_TEMPLATES.map((item) => (
              <button
                key={item.type}
                type="button"
                className="rounded-full bg-paper px-3 py-1 text-xs"
                onClick={() =>
                  setLines((current) => [
                    ...current,
                    { type: item.type, description: item.description, quantity: "1", unitPrice: "0", note: "" },
                  ])
                }
              >
                + {item.description}
              </button>
            ))}
          </div>

          <div className="hidden md:block">
            <div className="grid grid-cols-[140px_minmax(0,1fr)_80px_110px_90px_44px] gap-2 text-xs text-muted">
              <span>ประเภท</span>
              <span>รายละเอียด</span>
              <span>จำนวน</span>
              <span>ราคา/หน่วย</span>
              <span className="text-right">รวม</span>
              <span />
            </div>
            <div className="mt-2 space-y-2">
              {lines.map((line, index) => (
                <LineRow
                  key={`${line.id ?? "new"}-${index}`}
                  line={line}
                  onChange={(next) => setLines((current) => current.map((item, i) => (i === index ? next : item)))}
                  onRemove={() => setLines((current) => current.filter((_, i) => i !== index))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {lines.map((line, index) => (
              <div key={`${line.id ?? "new"}-m-${index}`} className="space-y-2 rounded-2xl bg-paper p-3">
                <select
                  className="admin-input"
                  value={line.type}
                  onChange={(e) =>
                    setLines((current) =>
                      current.map((item, i) => (i === index ? { ...item, type: e.target.value as QuotationItemType } : item)),
                    )
                  }
                >
                  {QUOTATION_ITEM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {QUOTATION_ITEM_LABEL[type]}
                    </option>
                  ))}
                </select>
                <input
                  className="admin-input"
                  placeholder="รายละเอียด"
                  value={line.description}
                  onChange={(e) =>
                    setLines((current) => current.map((item, i) => (i === index ? { ...item, description: e.target.value } : item)))
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="admin-input"
                    inputMode="decimal"
                    placeholder="จำนวน"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((current) => current.map((item, i) => (i === index ? { ...item, quantity: e.target.value } : item)))
                    }
                  />
                  <input
                    className="admin-input"
                    inputMode="decimal"
                    placeholder="ราคา/หน่วย"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((current) => current.map((item, i) => (i === index ? { ...item, unitPrice: e.target.value } : item)))
                    }
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>รวม {formatMoney(lineAmount(Number(line.quantity || 0), Number(line.unitPrice || 0)))}</span>
                  <button type="button" className="text-xs text-danger" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="h-10 rounded-xl bg-paper px-4 text-sm"
            onClick={() =>
              setLines((current) => [
                ...current,
                { type: "CUSTOM", description: "", quantity: "1", unitPrice: "0", note: "" },
              ])
            }
          >
            + เพิ่มรายการ
          </button>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">ส่วนลด</span>
              <input className="admin-input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">ประเภทมัดจำ</span>
              <select className="admin-input" value={depositType} onChange={(e) => setDepositType(e.target.value as QuotationDepositType)}>
                <option value="FIXED_AMOUNT">จำนวนคงที่</option>
                <option value="PERCENTAGE">เปอร์เซ็นต์</option>
                <option value="NONE">ไม่มีมัดจำ</option>
              </select>
            </label>
            {depositType !== "NONE" ? (
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted">
                  {depositType === "PERCENTAGE" ? "มัดจำ %" : "มัดจำ (บาท)"}
                </span>
                <input className="admin-input" inputMode="decimal" value={depositValue} onChange={(e) => setDepositValue(e.target.value)} />
              </label>
            ) : null}
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">ใช้ได้ถึง</span>
              <input className="admin-input" type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">รวมเวลา (ชม./วัน)</span>
              <input className="admin-input" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="8" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">OT บาท/ชม. (เงื่อนไข ไม่ใช่ยอดเรียกเก็บ)</span>
              <input className="admin-input" inputMode="decimal" value={otRate} onChange={(e) => setOtRate(e.target.value)} placeholder="200" />
            </label>
          </div>
          <textarea className="admin-input min-h-24 py-3" placeholder="เงื่อนไข" value={terms} onChange={(e) => setTerms(e.target.value)} />
          <textarea className="admin-input min-h-20 py-3" placeholder="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} />

          {"error" in totals ? (
            <p className="text-sm text-danger">{totals.error}</p>
          ) : (
            <dl className="grid gap-1 rounded-2xl bg-paper p-4 text-sm">
              <Total label="ยอดก่อนลด" value={totals.subtotal} />
              <Total label="ส่วนลด" value={totals.discountAmount} />
              <Total label="ยอดรวม" value={totals.totalAmount} />
              <Total label="มัดจำ" value={totals.depositRequiredAmount} />
              <Total label="ยอดคงเหลือ" value={totals.balanceAmount} />
            </dl>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
          <button type="button" disabled={pending} onClick={() => save(false)} className="h-11 rounded-xl bg-navy-800 px-4 text-sm text-white disabled:opacity-60">
            บันทึกร่าง
          </button>
          <button type="button" disabled={pending} onClick={() => save(true)} className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60">
            ส่งให้ลูกค้า
          </button>
          <button
            type="button"
            disabled={pending}
            className="h-11 rounded-xl bg-paper px-4 text-sm text-danger disabled:opacity-60"
            onClick={async () => {
              setPending(true);
              const result = await cancelQuotationAction(quote.id, bookingId);
              setPending(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              onSaved("ยกเลิกใบเสนอราคาแล้ว");
            }}
          >
            ยกเลิกฉบับนี้
          </button>
        </div>
      </aside>
    </div>
  );
}

function LineRow({
  line,
  onChange,
  onRemove,
}: {
  line: Line;
  onChange: (line: Line) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)_80px_110px_90px_44px] items-center gap-2">
      <select className="admin-input" value={line.type} onChange={(e) => onChange({ ...line, type: e.target.value as QuotationItemType })}>
        {QUOTATION_ITEM_TYPES.map((type) => (
          <option key={type} value={type}>
            {QUOTATION_ITEM_LABEL[type]}
          </option>
        ))}
      </select>
      <input className="admin-input" value={line.description} onChange={(e) => onChange({ ...line, description: e.target.value })} />
      <input className="admin-input" inputMode="decimal" value={line.quantity} onChange={(e) => onChange({ ...line, quantity: e.target.value })} />
      <input className="admin-input" inputMode="decimal" value={line.unitPrice} onChange={(e) => onChange({ ...line, unitPrice: e.target.value })} />
      <p className="text-right text-sm">{formatMoney(lineAmount(Number(line.quantity || 0), Number(line.unitPrice || 0)))}</p>
      <button type="button" className="text-xs text-danger" onClick={onRemove}>
        ลบ
      </button>
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{formatMoney(value)}</dd>
    </div>
  );
}
