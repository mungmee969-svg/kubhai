import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RememberStoreContext } from "@/components/brand/RememberStoreContext";
import {
  ContactStoreLinks,
  StoreBrandScope,
  StoreLogo,
} from "@/components/brand/StoreBrand";
import { brandingMetadata } from "@/components/brand/CustomerStoreChrome";
import { BookingAccountBanner } from "@/components/booking/BookingAccountBanner";
import { CustomerPaymentProof } from "@/components/booking/CustomerPaymentProof";
import { CustomerQuotation } from "@/components/quotation/CustomerQuotation";
import { StoreTipsCard } from "@/components/storefront/StoreTipsCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import { SERVICE_TYPE_LABELS } from "@/lib/domain/enums";
import { publicBookingRecord } from "@/lib/domain/public-view";
import { revealsAssignment } from "@/lib/domain/booking-rules";
import { publicPaymentAccount, publicPaymentProof } from "@/lib/domain/payment-accounts";
import { currentCustomerQuotation } from "@/lib/domain/quotation";
import { settleBooking } from "@/lib/domain/settlement";
import {
  customerTripLabel,
  deriveTripProgress,
} from "@/lib/domain/location";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  if (!token || token.length < 20) return { title: "การจอง" };
  const raw = await getStore().getBookingByToken(token);
  if (!raw) return { title: "การจอง" };
  // Public metadata only — no customer/route/payment details
  return brandingMetadata(raw.business, "การจอง");
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const raw = await getStore().getBookingByToken(token);
  if (!raw) notFound();

  // Returning from login / phone verification with ?claim=1 — retry the link once.
  const session = await getCustomerSession();
  if (
    query.claim === "1" &&
    session?.phoneVerified &&
    !raw.booking.customerAccountId
  ) {
    const claimed = await getStore()
      .claimBookingByToken(session.customerAccountId, token)
      .then(() => true)
      .catch(() => false);
    if (claimed) redirect(`/booking/${token}`);
  }

  const brand = resolveCustomerStorefrontBranding(raw.business);
  const settlement = settleBooking(raw.booking, raw.movements);
  const record = publicBookingRecord(raw);
  const { booking, business, vehicle, driver, itinerary } = record;
  const confirmed = revealsAssignment(booking.status);
  const tripLabel = customerTripLabel(
    deriveTripProgress({
      status: raw.booking.status,
      actualStartAt: raw.booking.actualStartAt,
      pickupCheckIn: raw.tripCheckIns.find((item) => item.kind === "PICKUP") ?? null,
      dropoffCheckIn: raw.tripCheckIns.find((item) => item.kind === "DROPOFF") ?? null,
    }),
  );
  const publicAccount = raw.receivingAccount ? publicPaymentAccount(raw.receivingAccount) : null;
  const publicProofs = raw.proofs.map(publicPaymentProof);
  const quotation = currentCustomerQuotation(raw.quotations, raw.booking.acceptedQuotationId);
  const accepted = raw.quotations.find((item) => item.id === raw.booking.acceptedQuotationId);
  const showPayment = accepted
    ? accepted.depositRequiredAmount > 0 || settlement.customerPaidService > 0
    : ["WAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status);
  const publicStore = await getStore().getPublicStore(business.slug);
  const tipSettings = publicStore?.settings?.tips ?? [];

  return (
    <StoreBrandScope brand={brand} className="min-h-dvh bg-store-paper">
      <RememberStoreContext slug={business.slug} />
      <header className="bg-store text-white">
        <div className="mx-auto max-w-lg px-5 py-7">
          <div className="flex items-center gap-3">
            <StoreLogo brand={brand} size={40} className="bg-white" />
            <div>
              <p className="text-xs text-white/70">{brand.businessName}</p>
              <h1 className="text-2xl font-semibold">{booking.bookingCode}</h1>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={booking.status} audience="customer" />
            {tripLabel ? (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs text-white">{tripLabel}</span>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-5 py-6">
        <BookingAccountBanner
          token={token}
          linked={Boolean(raw.booking.customerAccountId)}
          phoneVerified={Boolean(session?.phoneVerified)}
          loggedIn={Boolean(session)}
          storeSlug={business.slug}
          storeName={brand.shortName || brand.businessName}
        />

        {booking.status === "REQUESTED" ? (
          <section className="rounded-3xl bg-white p-5">
            <p className="text-lg font-semibold">ร้านกำลังตรวจสอบรถและราคา</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              ยังไม่ยืนยันการจอง {brand.shortName} จะติดต่อกลับเมื่อตรวจรถและเสนอราคาแล้ว
            </p>
          </section>
        ) : null}

        <section className="rounded-3xl bg-white p-5">
          <h2 className="font-semibold">รายละเอียดทริป</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="บริการ" value={SERVICE_TYPE_LABELS[booking.serviceType]} />
            <Row
              label="วันเวลา"
              value={`${booking.startDate}${booking.startTime ? ` ${booking.startTime}` : ""}`}
            />
            <Row label="รับที่" value={booking.pickupLocation} />
            {booking.pickupNote ? <Row label="หมายเหตุรับ" value={booking.pickupNote} /> : null}
            <Row label="ส่งที่" value={booking.dropoffLocation ?? "-"} />
            {booking.dropoffNote ? <Row label="หมายเหตุส่ง" value={booking.dropoffNote} /> : null}
            <Row label="ผู้โดยสาร" value={String(booking.passengerCount)} />
          </dl>
        </section>

        {tipSettings.length ? (
          <StoreTipsCard
            tips={tipSettings}
            storeName={brand.shortName || brand.businessName}
            serviceType={booking.serviceType}
            pickupLocation={booking.pickupLocation}
            dropoffLocation={booking.dropoffLocation}
            passengerCount={booking.passengerCount}
            luggageCount={booking.luggageCount}
            multiDay={booking.startDate !== booking.endDate}
            surface="DETAIL"
          />
        ) : null}

        {itinerary.length ? (
          <section className="rounded-3xl bg-white p-5">
            <h2 className="font-semibold">แผนทริป</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {itinerary.map((item, index) => (
                <li key={item.id}>
                  {index + 1}. {item.title}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="rounded-3xl bg-white p-5">
          <h2 className="font-semibold">รถ / คนขับ</h2>
          {vehicle ? (
            <p className="mt-2 text-sm">
              {vehicle.brand} {vehicle.model}
              {vehicle.color ? ` · ${vehicle.color}` : ""}
              {confirmed && vehicle.plateNumber ? ` · ${vehicle.plateNumber}` : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">ยังไม่ระบุรถ</p>
          )}
          {confirmed && driver ? (
            <p className="mt-2 text-sm">
              คนขับ {driver.name}
              {driver.phone ? ` · ${driver.phone}` : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">ข้อมูลคนขับจะแสดงเมื่อยืนยันการจอง</p>
          )}
        </section>

        {record.notes.filter((item) => item.audience === "CUSTOMER").length ? (
          <section className="rounded-3xl border border-store/15 bg-white p-5">
            <p className="text-xs font-semibold text-store">คำแนะนำจาก {brand.shortName || brand.businessName}</p>
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

        {quotation ? (
          <CustomerQuotation
            token={token}
            quotation={quotation}
            booking={raw.booking}
            business={business}
            customer={raw.customer}
            itinerary={raw.itinerary}
            customerTips={record.notes.filter((item) => item.audience === "CUSTOMER")}
          />
        ) : null}

        <section className="rounded-3xl bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <StoreLogo brand={brand} size={28} />
            <p className="text-sm font-semibold text-store">ชำระเงินให้ {brand.businessName}</p>
          </div>
          <CustomerPaymentProof
            token={token}
            bookingId={booking.id}
            bookingCode={booking.bookingCode}
            account={publicAccount}
            settlement={settlement}
            proofs={publicProofs}
            enabled={showPayment}
            storeName={brand.shortName || brand.businessName}
            title={
              accepted &&
              accepted.depositRequiredAmount > 0 &&
              settlement.depositReceived < accepted.depositRequiredAmount
                ? "ชำระมัดจำ"
                : "การชำระเงิน"
            }
          />
        </section>

        <div className="grid grid-cols-2 gap-3">
          {business.phone ? (
            <a
              href={`tel:${business.phone}`}
              className="flex h-12 items-center justify-center rounded-2xl bg-store text-white text-sm font-semibold"
            >
              ติดต่อร้าน
            </a>
          ) : (
            <span className="flex h-12 items-center justify-center rounded-2xl bg-line text-sm text-muted">
              ติดต่อร้าน
            </span>
          )}
          <Link
            href={`/s/${business.slug}`}
            className="flex h-12 items-center justify-center rounded-2xl bg-white text-sm font-semibold"
          >
            กลับหน้าร้าน
          </Link>
        </div>

        <ContactStoreLinks brand={brand} />
      </main>
    </StoreBrandScope>
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
