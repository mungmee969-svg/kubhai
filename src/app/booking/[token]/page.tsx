import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RememberStoreContext } from "@/components/brand/RememberStoreContext";
import {
  ContactStoreLinks,
  StoreLogo,
} from "@/components/brand/StoreBrand";
import { CustomerStoreIdentityLink } from "@/components/brand/CustomerStoreIdentityLink";
import { LocationMapPreview } from "@/components/maps/LocationMapPreview";
import { brandingMetadata } from "@/components/brand/CustomerStoreChrome";
import { BookingAccountBanner } from "@/components/booking/BookingAccountBanner";
import { CustomerPaymentProof } from "@/components/booking/CustomerPaymentProof";
import { CustomerQuotation } from "@/components/quotation/CustomerQuotation";
import { StoreTipsCard } from "@/components/storefront/StoreTipsCard";
import { CustomerExperienceShell } from "@/components/storefront/CustomerExperienceShell";
import { CustomerPrefsControls } from "@/components/storefront/CustomerPrefsControls";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import {
  getDurableBookingByToken,
  isDurableBookingConfigured,
} from "@/lib/data/supabase-booking";
import { seedBusinesses, seedVehicles } from "@/lib/data/seed";
import type { BookingRecord } from "@/lib/data/repository";
import { allowsCustomerLocales } from "@/lib/domain/booking-entitlements";
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
import { readCustomerLocaleCookie, readCustomerThemeCookie } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

async function loadBookingByToken(token: string): Promise<BookingRecord | null> {
  if (!token || token.length < 20) return null;

  if (isDurableBookingConfigured()) {
    try {
      const durable = await getDurableBookingByToken(token);
      if (durable) {
        // Booking persistence is already durable in Supabase. Storefront metadata is
        // still in the staged local repository, so use it when available and fall
        // back to the deterministic seed metadata. A valid durable token must not
        // become a false 404 merely because local storefront state is unavailable.
        const publicStore = await getStore()
          .getPublicStore(durable.businessSlug)
          .catch(() => null);
        const business =
          publicStore?.business ??
          seedBusinesses.find(
            (item) =>
              item.slug === durable.businessSlug ||
              item.id === durable.booking.businessId,
          ) ??
          null;

        if (!business) {
          console.error("[booking] durable token business metadata unavailable", {
            businessSlug: durable.businessSlug,
            bookingId: durable.booking.id,
          });
          return null;
        }

        const preferredVehicle = durable.booking.preferredVehicleId
          ? (publicStore?.vehicles.find(
              (item) => item.id === durable.booking.preferredVehicleId,
            ) ??
            seedVehicles.find(
              (item) => item.id === durable.booking.preferredVehicleId,
            ) ??
            null)
          : null;

        return {
          booking: durable.booking,
          itinerary: durable.itinerary,
          vehicle: null,
          preferredVehicle,
          driver: null,
          business,
          customer: null,
          notes: [],
          movements: [],
          proofs: [],
          receivingAccount: null,
          quotations: [],
          auditLogs: [],
          tripCheckIns: [],
        };
      }
    } catch (error) {
      console.error("[booking] durable token read failed", {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "UnknownError", message: String(error) },
      });
    }
  }

  return getStore().getBookingByToken(token);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  if (!token || token.length < 20) return { title: "การจอง" };
  const raw = await loadBookingByToken(token);
  if (!raw) return { title: "การจอง" };
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
  const raw = await loadBookingByToken(token);
  if (!raw) notFound();

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
  const [locale, theme] = await Promise.all([
    readCustomerLocaleCookie(),
    readCustomerThemeCookie(),
  ]);
  const t = (key: string) => translate(locale, key);
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
  const publicStore = await getStore().getPublicStore(business.slug).catch(() => null);
  const tipSettings = publicStore?.settings?.tips ?? [];

  return (
    <CustomerExperienceShell
      brand={brand}
      storeSlug={business.slug}
      multilingual={allowsCustomerLocales(raw.business.subscriptionPlan)}
      initialLocale={locale}
      initialTheme={theme}
      className="min-h-dvh"
    >
      <RememberStoreContext slug={business.slug} />
      <header className="bg-store text-white">
        <div className="mx-auto max-w-lg px-5 py-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CustomerStoreIdentityLink
                brand={brand}
                storeSlug={business.slug}
                subtitle={t("bookingDetail.title")}
                logoSize={40}
                subtitleClassName="text-white/70"
              />
              <h1 className="mt-1 text-2xl font-semibold">{booking.bookingCode}</h1>
            </div>
            <CustomerPrefsControls compact />
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
          <section className="rounded-3xl bg-[color:var(--cx-surface)] p-5">
            <p className="text-lg font-semibold">{t("booking.quotePending")}</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t("booking.notConfirmed")}
            </p>
          </section>
        ) : null}

        <section className="rounded-3xl bg-[color:var(--cx-surface)] p-5">
          <h2 className="font-semibold">{t("bookingDetail.title")}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label={t("bookingDetail.service")} value={SERVICE_TYPE_LABELS[booking.serviceType]} />
            <Row
              label={t("bookingDetail.schedule")}
              value={`${booking.startDate}${booking.startTime ? ` ${booking.startTime}` : ""}`}
            />
            <Row label={t("booking.pickup")} value={booking.pickupLocation} />
            {booking.pickupNote ? <Row label="หมายเหตุรับ" value={booking.pickupNote} /> : null}
            <Row label={t("booking.dropoff")} value={booking.dropoffLocation ?? "-"} />
            {booking.dropoffNote ? <Row label="หมายเหตุส่ง" value={booking.dropoffNote} /> : null}
            <Row label={t("booking.passengers")} value={String(booking.passengerCount)} />
            {booking.pickupLat != null && booking.pickupLng != null ? (
              <LocationMapPreview
                latitude={booking.pickupLat}
                longitude={booking.pickupLng}
                label={booking.pickupLocation}
                notConfiguredLabel={t("maps.notConfigured")}
                coordinatesUnavailableLabel={t("maps.coordinatesUnavailable")}
                className="mt-3"
              />
            ) : null}
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
          <section className="rounded-3xl bg-[color:var(--cx-surface)] p-5">
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

        <section className="rounded-3xl bg-[color:var(--cx-surface)] p-5">
          <h2 className="font-semibold">{t("bookingDetail.vehicle")}</h2>
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
          <section className="rounded-3xl border border-store/15 bg-[color:var(--cx-surface)] p-5">
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

        <section className="rounded-3xl bg-[color:var(--cx-surface)] p-5">
          <div className="mb-3 flex items-center gap-2">
            <StoreLogo brand={brand} size={28} />
            <p className="text-sm font-semibold text-store">
              {t("bookingDetail.payment")} · {brand.businessName}
            </p>
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
              {t("common.contactStore")}
            </a>
          ) : (
            <span className="flex h-12 items-center justify-center rounded-2xl bg-line text-sm text-muted">
              {t("common.contactStore")}
            </span>
          )}
          <Link
            href={`/s/${business.slug}`}
            className="flex h-12 items-center justify-center rounded-2xl bg-[color:var(--cx-surface)] text-sm font-semibold"
          >
            {t("auth.backToStore")}
          </Link>
        </div>

        <ContactStoreLinks brand={brand} />
      </main>
    </CustomerExperienceShell>
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
