"use client";

import { useState } from "react";
import Link from "next/link";
import { QuotationBuilder } from "@/components/quotation/QuotationBuilder";
import { QuotationDocument } from "@/components/quotation/QuotationDocument";
import {
  createQuotationDraftAction,
  createQuotationRevisionAction,
} from "@/lib/actions/quotation";
import { currentAdminQuotation, QUOTATION_STATUS_LABEL } from "@/lib/domain/quotation";
import { formatMoney } from "@/lib/domain/ops";
import type { BookingRecord, QuotationRecord } from "@/lib/data/repository";

export function QuotationPanel({
  record,
  pending,
  onRun,
}: {
  record: BookingRecord;
  pending: boolean;
  onRun: (
    fn: () => Promise<{ ok: true; data?: { id?: string } } | { ok: false; error: string }>,
    okMessage?: string,
  ) => Promise<void>;
}) {
  const [builder, setBuilder] = useState<QuotationRecord | null>(null);
  const [view, setView] = useState<QuotationRecord | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const current = currentAdminQuotation(record.quotations);
  const openedDraft = openId
    ? record.quotations.find((item) => item.id === openId && item.status === "DRAFT") ?? null
    : null;
  const activeBuilder = builder ?? openedDraft;
  const moneyIn = record.movements.some((item) => item.direction === "IN");
  const accepted = record.quotations.find((item) => item.id === record.booking.acceptedQuotationId);
  const history = [...record.quotations].sort((a, b) => b.version - a.version);

  async function createDraft() {
    await onRun(async () => {
      const result = await createQuotationDraftAction(record.booking.id);
      if (result.ok && result.data?.id) setOpenId(result.data.id);
      return result;
    }, "สร้างร่างใบเสนอราคาแล้ว");
  }

  return (
    <section className="rounded-2xl bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy-800">ใบเสนอราคา</h2>
          <p className="mt-1 text-sm text-muted">
            {current
              ? `${current.quotationNumber} · ฉบับที่ ${current.version} · ${QUOTATION_STATUS_LABEL[current.status]}`
              : "ยังไม่มีใบเสนอราคา"}
          </p>
        </div>
        {!current ? (
          <button type="button" disabled={pending} onClick={createDraft} className="h-10 rounded-xl bg-navy-800 px-4 text-sm text-white disabled:opacity-60">
            สร้างใบเสนอราคา
          </button>
        ) : null}
        {current?.status === "DRAFT" ? (
          <button type="button" onClick={() => setBuilder(current)} className="h-10 rounded-xl bg-navy-800 px-4 text-sm text-white">
            แก้ร่าง
          </button>
        ) : null}
        {current && current.status !== "DRAFT" ? (
          <button
            type="button"
            disabled={pending}
            className="h-10 rounded-xl bg-paper px-4 text-sm disabled:opacity-60"
            onClick={() =>
              onRun(async () => {
                const result = await createQuotationRevisionAction(current.id, record.booking.id);
                if (result.ok && result.data?.id) setOpenId(result.data.id);
                return result;
              }, "สร้างฉบับแก้ไขแล้ว")
            }
          >
            สร้างฉบับแก้ไข
          </button>
        ) : null}
      </div>

      {current?.status === "CUSTOMER_CHANGE_REQUESTED" ? (
        <div className="mt-4 rounded-2xl border border-accent bg-accent/15 p-4">
          <p className="font-semibold text-navy-800">ลูกค้าขอแก้ไขใบเสนอราคา</p>
          <p className="mt-1 text-sm">{current.changeRequestText}</p>
        </div>
      ) : null}

      {accepted && moneyIn ? (
        <p className="mt-3 rounded-2xl bg-paper px-3 py-2 text-sm text-navy-800">มีการรับเงินตามใบเสนอราคาเดิมแล้ว</p>
      ) : null}

      {current ? (
        <div className="mt-4">
          <QuotationDocument
            quotation={current}
            booking={record.booking}
            business={record.business}
            customer={record.customer}
            itinerary={record.itinerary}
            customerTips={record.notes.filter((item) => item.audience === "CUSTOMER")}
          />
        </div>
      ) : null}

      {history.length ? (
        <div className="mt-5">
          <h3 className="text-sm font-medium text-navy-800">ประวัติฉบับ</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {history.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2">
                <div>
                  <p>
                    {item.quotationNumber} · v{item.version} — {QUOTATION_STATUS_LABEL[item.status]}
                  </p>
                  <p className="text-xs text-muted">
                    {formatMoney(item.totalAmount)}
                    {item.sentAt ? ` · ส่ง ${item.sentAt.slice(0, 10)}` : ""}
                    {item.acceptedAt ? ` · ยืนยัน ${item.acceptedAt.slice(0, 10)}` : ""}
                    {item.changeRequestedAt ? ` · ขอแก้ ${item.changeRequestedAt.slice(0, 10)}` : ""}
                    {item.rejectedAt ? ` · ปฏิเสธ ${item.rejectedAt.slice(0, 10)}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="text-xs text-navy-800" onClick={() => setView(item)}>
                    ดูใบ
                  </button>
                  <Link href={`/store/bookings/${record.booking.id}/quotations/${item.id}/print`} className="text-xs text-navy-800">
                    พิมพ์
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {activeBuilder ? (
        <QuotationBuilder
          quote={activeBuilder}
          bookingId={record.booking.id}
          onClose={() => {
            setBuilder(null);
            setOpenId(null);
          }}
          onSaved={(message) => {
            setBuilder(null);
            setOpenId(null);
            onRun(async () => ({ ok: true }), message);
          }}
        />
      ) : null}

      {view ? (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-navy-950/40" onClick={() => setView(null)} />
          <aside className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="mb-4 flex justify-between">
              <h3 className="font-semibold text-navy-800">ใบเสนอราคา</h3>
              <button type="button" onClick={() => setView(null)} className="text-sm text-muted">
                ปิด
              </button>
            </div>
            <QuotationDocument
              quotation={view}
              booking={record.booking}
              business={record.business}
              customer={record.customer}
              itinerary={record.itinerary}
              customerTips={record.notes.filter((item) => item.audience === "CUSTOMER")}
            />
          </aside>
        </div>
      ) : null}
    </section>
  );
}
