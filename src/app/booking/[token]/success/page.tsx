import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RememberStoreContext } from "@/components/brand/RememberStoreContext";
import {
  ContactStoreLinks,
} from "@/components/brand/StoreBrand";
import { CustomerStoreIdentityLink } from "@/components/brand/CustomerStoreIdentityLink";
import { brandingMetadata } from "@/components/brand/CustomerStoreChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CustomerExperienceShell } from "@/components/storefront/CustomerExperienceShell";
import { CustomerPrefsControls } from "@/components/storefront/CustomerPrefsControls";
import {
  partnerBookingsClaimPath,
  partnerLoginHrefWithClaim,
} from "@/lib/auth/customer-auth-links";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import { allowsCustomerLocales } from "@/lib/domain/booking-entitlements";
import { resolveBookingPresentation } from "@/lib/domain/booking-presentation";
import { revealsAssignment } from "@/lib/domain/booking-rules";
import { readCustomerLocaleCookie, readCustomerThemeCookie } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  if (!token || token.length < 20) return { title: "ส่งคำขอจอง" };
  const raw = await getStore().getBookingByToken(token);
  if (!raw) return { title: "ส่งคำขอจอง" };
  return brandingMetadata(raw.business, "ส่งคำขอจอง");
}

export default async function BookingSuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const raw = await getStore().getBookingByToken(token);
  if (!raw) notFound();
  const brand = resolveCustomerStorefrontBranding(raw.business);
  const [locale, theme] = await Promise.all([
    readCustomerLocaleCookie(),
    readCustomerThemeCookie(),
  ]);
  const t = (key: string) => translate(locale, key);
  const presentation = resolveBookingPresentation({ business: raw.business });
  const { booking, business } = raw;
  const confirmed = revealsAssignment(booking.status);
  const session = await getCustomerSession();
  // Guest bookings are only reachable by token — carry it so «my bookings» is never empty.
  const myBookingsHref = session
    ? partnerBookingsClaimPath(business.slug, token)
    : partnerLoginHrefWithClaim(business.slug, `/s/${business.slug}/bookings`, token);
  const headline = confirmed ? t("success.title.confirmed") : t("success.title.request");
  const hero = presentation.hero.desktopUrl;

  const timeline = confirmed
    ? [
        { done: true, label: t("status.REQUESTED") },
        { done: true, label: t("status.CHECKING_AVAILABILITY") },
        { done: true, label: t("status.QUOTATION_SENT") },
        { done: true, label: t("payment.approved") },
        { done: true, label: t("status.CONFIRMED") },
      ]
    : [
        { done: true, label: t("status.REQUESTED") },
        { done: false, label: t("status.CHECKING_AVAILABILITY") },
        { done: false, label: t("status.QUOTATION_SENT") },
        { done: false, label: t("status.CUSTOMER_CONFIRMED") },
        { done: false, label: t("bookingDetail.payment") },
        { done: false, label: t("status.CONFIRMED") },
      ];

  return (
    <CustomerExperienceShell
      brand={brand}
      storeSlug={business.slug}
      multilingual={allowsCustomerLocales(raw.business.subscriptionPlan)}
      initialLocale={locale}
      initialTheme={theme}
      className="booking-shell booking-atm-review min-h-dvh"
    >
      <RememberStoreContext slug={business.slug} />
      <div className="booking-shell-bg" aria-hidden />

      <header className="relative overflow-hidden text-white booking-hero-short">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        ) : null}
        <div className="booking-hero-overlay absolute inset-0" />
        <div className="relative mx-auto max-w-lg px-5 pb-10 pt-6 text-center">
          <div className="absolute right-4 top-4">
            <CustomerPrefsControls compact />
          </div>
          <div className="mx-auto mb-3 flex justify-center">
            <CustomerStoreIdentityLink
              brand={brand}
              storeSlug={business.slug}
              logoSize={48}
              showName={false}
            />
          </div>
          <p className="text-3xl" aria-hidden>
            ✓
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{headline}</h1>
          {!confirmed ? (
            <p className="mt-2 text-sm text-white/80">{t("booking.quotePending")}</p>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-6 max-w-lg space-y-4 px-4 pb-10">
        <section className="booking-review-card text-center">
          <p className="text-xs text-muted">{t("bookingDetail.code")}</p>
          <p className="mt-1 text-xl font-semibold tracking-wide text-[color:var(--store-primary,#0F3D3E)]">
            {booking.bookingCode}
          </p>
          <div className="mt-3 flex justify-center">
            <StatusBadge status={booking.status} audience="customer" />
          </div>
          <dl className="mt-4 space-y-2 text-left text-sm">
            <Row
              label={t("bookingDetail.schedule")}
              value={`${booking.startDate}${booking.startTime ? ` ${booking.startTime}` : ""}`}
            />
            <Row label={t("booking.pickup")} value={booking.pickupLocation} />
            <Row label={t("booking.dropoff")} value={booking.dropoffLocation ?? "-"} />
          </dl>
        </section>

        {!confirmed ? (
          <section className="booking-review-card">
            <p className="mb-3 text-sm font-semibold">{t("success.next")}</p>
            <ol className="space-y-0">
              {timeline.map((item, index) => (
                <li key={item.label} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < timeline.length - 1 ? (
                    <span
                      className="absolute left-[11px] top-6 bottom-0 w-px bg-[color:var(--store-primary,#0F3D3E)]/20"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      item.done
                        ? "bg-[color:var(--store-accent,#C4A35A)] text-[#1a1510]"
                        : "bg-[color:var(--store-primary-soft,#E7EFEA)] text-[color:var(--store-primary,#0F3D3E)]"
                    }`}
                  >
                    {item.done ? "✓" : index + 1}
                  </span>
                  <span className={`pt-0.5 text-sm ${item.done ? "font-medium" : ""}`}>{item.label}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs leading-5 text-muted">
              {t("booking.notConfirmed")}
            </p>
          </section>
        ) : (
          <p className="booking-review-card text-sm leading-6 text-muted">
            {t("success.title.confirmed")}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Link href={`/booking/${token}`} className="booking-cta-gold">
            {t("success.viewDetails")}
          </Link>
          <Link
            href={myBookingsHref}
            className="flex h-[3.15rem] items-center justify-center rounded-2xl bg-[color:var(--cx-surface)] text-sm font-semibold shadow-sm"
          >
            {t("success.myBookings")}
          </Link>
          {business.phone ? (
            <a
              href={`tel:${business.phone}`}
              className="flex h-[3.15rem] items-center justify-center rounded-2xl bg-[color:var(--cx-surface)] text-sm font-semibold shadow-sm"
            >
              {t("success.contact")}
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex h-[3.15rem] items-center justify-center rounded-2xl bg-line text-sm text-muted"
            >
              {t("success.contact")}
            </button>
          )}
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
