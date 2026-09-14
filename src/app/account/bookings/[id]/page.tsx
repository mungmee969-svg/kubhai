import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CustomerPaymentProof } from "@/components/booking/CustomerPaymentProof";
import { CustomerQuotation } from "@/components/quotation/CustomerQuotation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { revealsAssignment } from "@/lib/domain/booking-rules";
import { buildBookingCloseout } from "@/lib/domain/closeout";
import { SERVICE_TYPE_LABELS } from "@/lib/domain/enums";
import {
  customerTripLabel,
  deriveTripProgress,
} from "@/lib/domain/location";
import { formatMoney, formatThaiDate } from "@/lib/domain/ops";
import { publicPaymentAccount, publicPaymentProof } from "@/lib/domain/payment-accounts";
import { currentCustomerQuotation } from "@/lib/domain/quotation";
import { settleBooking } from "@/lib/domain/settlement";

export const dynamic = "force-dynamic";

export default async function AccountBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");
  const { id } = await params;
  const record = await getStore().getCustomerBookingRecord(session.customerAccountId, id);
  if (!record) notFound();

  // Customer-safe: strip internal notes, audit, payout internals from UI usage
  const settlement = settleBooking(record.booking, record.movements);
  const closeout = buildBookingCloseout(record.booking, record.movements, { vehicle: record.vehicle });
  const outstanding = closeout.customerOutstanding ?? 0;
  const quotation = currentCustomerQuotation(record.quotations, record.booking.acceptedQuotationId);
  const accepted = record.quotations.find((item) => item.id === record.booking.acceptedQuotationId);
  const confirmed = revealsAssignment(record.booking.status);
  const tripLabel = customerTripLabel(
    deriveTripProgress({
      status: record.booking.status,
      actualStartAt: record.booking.actualStartAt,
      pickupCheckIn: record.tripCheckIns.find((item) => item.kind === "PICKUP") ?? null,
      dropoffCheckIn: record.tripCheckIns.find((item) => item.kind === "DROPOFF") ?? null,
    }),
  );
  const publicAccount = record.receivingAccount ? publicPaymentAccount(record.receivingAccount) : null;
  const publicProofs = record.proofs.map(publicPaymentProof);
  const showPayment = accepted
    ? accepted.depositRequiredAmount > 0 || settlement.customerPaidService > 0 || outstanding > 0
    : ["WAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(record.booking.status);

  return (
    <div className="space-y-4">
      <Link href="/account/bookings" className="text-sm text-muted">
        ← การจองทั้งหมด
      </Link>
      <header className="rounded-3xl bg-white p-5">
        <p className="text-xs text-muted">{record.business.name}</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-800">{record.booking.bookingCode}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={record.booking.status} />
          {tripLabel ? (
            <span className="rounded-full bg-paper px-3 py-1 text-xs text-navy-800">{tripLabel}</span>
          ) : null}
          {closeout.outstandingBadge ? (
            <span className="rounded-full bg-accent/25 px-3 py-1 text-xs font-semibold text-navy-800">
              {closeout.outstandingBadge}
            </span>
          ) : null}
        </div>
      </header>

      {outstanding > 0 ? (
        <section className="rounded-3xl border border-accent bg-accent/15 p-5">
          <p className="font-semibold text-navy-800">ยอดคงเหลือ {formatMoney(outstanding)}</p>
          <p className="mt-1 text-sm text-navy-800">
            ยอดงาน {formatMoney(closeout.acceptedQuotationTotal)} · ชำระแล้ว{" "}
            {formatMoney(closeout.serviceCashReceived)}
            {closeout.tipReceived ? ` · ทิป ${formatMoney(closeout.tipReceived)}` : ""}
          </p>
          {showPayment && publicAccount ? (
            <p className="mt-3 text-sm font-semibold text-navy-800">ชำระยอดคงเหลือด้านล่าง</p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold text-navy-800">รายละเอียดทริป</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">บริการ</dt>
            <dd>{SERVICE_TYPE_LABELS[record.booking.serviceType]}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">วันเวลา</dt>
            <dd>
              {formatThaiDate(record.booking.startDate)} {record.booking.startTime ?? ""}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">รับที่</dt>
            <dd className="text-right">{record.booking.pickupLocation}</dd>
          </div>
          {record.booking.pickupNote ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">หมายเหตุรับ</dt>
              <dd className="text-right">{record.booking.pickupNote}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-muted">ส่งที่</dt>
            <dd className="text-right">{record.booking.dropoffLocation ?? "-"}</dd>
          </div>
          {record.booking.dropoffNote ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">หมายเหตุส่ง</dt>
              <dd className="text-right">{record.booking.dropoffNote}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {record.notes.filter((item) => item.audience === "CUSTOMER").length ? (
        <section className="rounded-3xl bg-white p-5">
          <p className="text-xs font-semibold text-navy-800">
            คำแนะนำจาก {record.business.shortName || record.business.name}
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {record.notes
              .filter((item) => item.audience === "CUSTOMER")
              .map((item) => (
                <li key={item.id}>
                  {item.title ? <span className="font-medium">{item.title} — </span> : null}
                  {item.body}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {record.vehicle && confirmed ? (
        <section className="rounded-3xl bg-white p-5">
          <h2 className="font-semibold text-navy-800">รถ / คนขับ</h2>
          <p className="mt-2 text-sm">
            {record.vehicle.brand} {record.vehicle.model}
          </p>
          {record.driver ? <p className="mt-1 text-sm text-muted">{record.driver.name}</p> : null}
        </section>
      ) : null}

      {quotation ? (
        <CustomerQuotation
          token={record.booking.securePublicToken}
          quotation={quotation}
          booking={record.booking}
          business={record.business}
          customer={record.customer}
          itinerary={record.itinerary}
          customerTips={record.notes.filter((item) => item.audience === "CUSTOMER")}
        />
      ) : null}

      {showPayment && publicAccount ? (
        <CustomerPaymentProof
          token={record.booking.securePublicToken}
          bookingId={record.booking.id}
          bookingCode={record.booking.bookingCode}
          account={publicAccount}
          proofs={publicProofs}
          settlement={settlement}
          title={outstanding > 0 ? `ชำระยอดคงเหลือ ฿${outstanding.toLocaleString("th-TH")}` : "การชำระเงิน"}
        />
      ) : null}

      <p className="text-center text-xs text-muted">
        <Link href={`/booking/${record.booking.securePublicToken}`}>เปิดลิงก์จองแบบโทเคน</Link>
      </p>
    </div>
  );
}
