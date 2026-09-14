import { QUOTATION_ITEM_LABEL, QUOTATION_STATUS_LABEL, companyBilling } from "@/lib/domain/quotation";
import { formatMoney, formatThaiDate } from "@/lib/domain/ops";
import { resolveBusinessBranding } from "@/lib/domain/branding";
import { StoreLogo } from "@/components/brand/StoreBrand";
import { QuotationItinerarySummary } from "@/components/booking/ItineraryDaysView";
import type { QuotationRecord } from "@/lib/data/repository";
import type { Booking, BookingItineraryItem, BookingNote, Business, Customer } from "@/lib/domain/types";

export function QuotationDocument({
  quotation,
  booking,
  business,
  customer,
  itinerary = [],
  customerTips = [],
}: {
  quotation: QuotationRecord;
  booking: Booking;
  business: Business;
  customer: Customer | null;
  itinerary?: BookingItineraryItem[];
  customerTips?: BookingNote[];
}) {
  const billing = companyBilling(booking, customer);
  const brand = resolveBusinessBranding(business);
  return (
    <div className="space-y-5" style={{ ["--store-primary" as string]: brand.primaryColor }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <StoreLogo brand={brand} size={48} />
          <div>
            <p className="text-xs text-muted">{brand.businessName}</p>
            <h2 className="text-xl font-semibold text-navy-800">ใบเสนอราคา</h2>
            <p className="mt-1 text-sm">
              {quotation.quotationNumber} · ฉบับที่ {quotation.version}
            </p>
            {brand.phone ? <p className="mt-1 text-xs text-muted">โทร {brand.phone}</p> : null}
          </div>
        </div>
        <p className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-navy-800">
          {QUOTATION_STATUS_LABEL[quotation.status]}
        </p>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <Row label="ลูกค้า" value={booking.customerNameSnapshot} />
        <Row label="วันที่บริการ" value={`${formatThaiDate(booking.startDate)}${booking.endDate ? ` – ${formatThaiDate(booking.endDate)}` : ""}`} />
        <Row label="รับที่" value={booking.pickupLocation} />
        <Row label="ส่งที่" value={booking.dropoffLocation ?? "—"} />
      </dl>

      {itinerary.length ? (
        <QuotationItinerarySummary
          itinerary={itinerary}
          startDate={booking.startDate}
          endDate={booking.endDate}
        />
      ) : null}

      {customerTips.filter((item) => item.audience === "CUSTOMER").length ? (
        <div className="rounded-2xl border border-[color:var(--store-primary,#0F3D3E)]/15 bg-paper p-4 text-sm">
          <p className="text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)]">
            คำแนะนำจาก {brand.shortName || brand.businessName}
          </p>
          <ul className="mt-2 space-y-2">
            {customerTips
              .filter((item) => item.audience === "CUSTOMER")
              .map((item) => (
                <li key={item.id}>
                  {item.title ? <span className="font-medium">{item.title} — </span> : null}
                  {item.body}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {billing ? (
        <div className="rounded-2xl bg-paper p-4 text-sm">
          <p className="text-xs text-muted">ข้อมูลบริษัท</p>
          <p className="mt-1 font-medium">{billing.companyName ?? "—"}</p>
          {billing.taxId ? <p>เลขผู้เสียภาษี {billing.taxId}</p> : null}
          {billing.branchType ? (
            <p>
              {billing.branchType === "HQ" ? "สำนักงานใหญ่" : "สาขา"}
              {billing.branchNumber ? ` ${billing.branchNumber}` : ""}
            </p>
          ) : null}
          {billing.address ? <p>{billing.address}</p> : null}
          {billing.invoiceEmail ? <p>{billing.invoiceEmail}</p> : null}
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">รายการ</th>
              <th className="px-3 py-2 font-medium">จำนวน</th>
              <th className="px-3 py-2 font-medium">ราคา/หน่วย</th>
              <th className="px-3 py-2 text-right font-medium">รวม</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <p>{item.description}</p>
                  <p className="text-xs text-muted">{QUOTATION_ITEM_LABEL[item.type]}</p>
                </td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">{formatMoney(item.unitPrice)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {quotation.items.map((item) => (
          <li key={item.id} className="rounded-2xl bg-paper p-3 text-sm">
            <p className="font-medium">{item.description}</p>
            <p className="text-xs text-muted">{QUOTATION_ITEM_LABEL[item.type]}</p>
            <p className="mt-1">
              {item.quantity} × {formatMoney(item.unitPrice)} = {formatMoney(item.amount)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="space-y-1 text-sm">
        <Row label="ยอดก่อนลด" value={formatMoney(quotation.subtotal)} />
        <Row label="ส่วนลด" value={formatMoney(quotation.discountAmount)} />
        <Row label="ยอดรวม" value={formatMoney(quotation.totalAmount)} />
        <Row
          label="มัดจำ"
          value={
            quotation.depositType === "NONE"
              ? "ไม่มีมัดจำ"
              : quotation.depositType === "PERCENTAGE"
                ? `${quotation.depositValue}% · ${formatMoney(quotation.depositRequiredAmount)}`
                : formatMoney(quotation.depositRequiredAmount)
          }
        />
        <Row label="ยอดคงเหลือ" value={formatMoney(quotation.balanceAmount)} />
      </dl>

      {quotation.includedHoursPerDay != null || quotation.overtimeRatePerHour != null ? (
        <div className="rounded-2xl bg-paper p-4 text-sm">
          <p className="font-medium text-navy-800">เงื่อนไขเวลา</p>
          {quotation.includedHoursPerDay != null ? (
            <p className="mt-1">รวม {quotation.includedHoursPerDay} ชั่วโมง / วัน</p>
          ) : null}
          {quotation.overtimeRatePerHour != null ? (
            <p>ค่าล่วงเวลา (OT) {formatMoney(quotation.overtimeRatePerHour)} / ชั่วโมง</p>
          ) : null}
          <p className="mt-1 text-xs text-muted">
            เป็นเงื่อนไขในใบเสนอราคา — ยังไม่ใช่ยอดเรียกเก็บจนกว่าจะบันทึกหลังจบงาน
          </p>
        </div>
      ) : null}

      {quotation.terms ? (
        <div>
          <p className="text-xs text-muted">เงื่อนไข</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{quotation.terms}</p>
        </div>
      ) : null}
      {quotation.validUntil ? (
        <p className="text-sm text-muted">ใช้ได้ถึง {quotation.validUntil.slice(0, 16).replace("T", " ")}</p>
      ) : null}
      {quotation.note ? <p className="text-sm">{quotation.note}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
