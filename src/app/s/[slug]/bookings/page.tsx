import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CustomerExperienceShell } from "@/components/storefront/CustomerExperienceShell";
import { PartnerCustomerNav } from "@/components/storefront/PartnerCustomerNav";
import { CustomerStoreIdentityLink } from "@/components/brand/CustomerStoreIdentityLink";
import {
  bookingDetailClaimPath,
  partnerLoginHref,
  partnerLoginHrefWithClaim,
} from "@/lib/auth/customer-auth-links";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import {
  allowsCustomerLocales,
  allowsTripDiscovery,
} from "@/lib/domain/booking-entitlements";
import { SERVICE_TYPE_LABELS } from "@/lib/domain/enums";
import { formatThaiDate } from "@/lib/domain/ops";
import { customerStatusMessageKey } from "@/lib/domain/status-ui";
import {
  readCustomerLocaleCookie,
  readCustomerThemeCookie,
  serverT,
} from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

export default async function PartnerMyBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const claimToken = typeof query.claim === "string" ? query.claim.trim() : "";
  const store = await getStore().getPublicStore(slug);
  if (!store) notFound();

  const session = await getCustomerSession();
  if (!session) {
    redirect(
      claimToken
        ? partnerLoginHrefWithClaim(slug, `/s/${slug}/bookings`, claimToken)
        : partnerLoginHref(slug, `/s/${slug}/bookings`),
    );
  }

  // Claim before listing: a guest booking is only discoverable by token, so an
  // unclaimed booking would otherwise never appear in the account.
  let claimBlocked = false;
  if (claimToken) {
    const claimed =
      session.phoneVerified &&
      (await getStore()
        .claimBookingByToken(session.customerAccountId, claimToken)
        .then(() => true)
        // Wrong phone, or already linked to another account — the token page explains why.
        .catch(() => false));
    if (claimed) redirect(`/s/${slug}/bookings`);
    claimBlocked = true;
  }

  const brand = resolveCustomerStorefrontBranding(store.business);
  const multilingual = allowsCustomerLocales(store.business.subscriptionPlan);
  const locale = await readCustomerLocaleCookie();
  const theme = await readCustomerThemeCookie();
  const all = await getStore().listCustomerBookings(session.customerAccountId);
  const bookings = all.filter((item) => item.businessId === store.business.id);
  const title = await serverT("myBookings.title");

  return (
    <CustomerExperienceShell
      brand={brand}
      storeSlug={slug}
      initialLocale={locale}
      initialTheme={theme}
      multilingual={multilingual}
      className="min-h-dvh"
    >
      <header className="bg-[color:var(--store-primary,#0F3D3E)] text-white">
        <div className="mx-auto max-w-lg px-4 py-4">
          <CustomerStoreIdentityLink
            brand={brand}
            storeSlug={slug}
            subtitle={title}
            className="max-w-full"
            subtitleClassName="text-white/75"
          />
          <div className="mt-3">
            <PartnerCustomerNav
              slug={slug}
              loggedIn
              active="account"
              showTravel={allowsTripDiscovery(store.business.subscriptionPlan)}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-[color:var(--cx-textPrimary)]">{title}</h1>
        {claimBlocked ? (
          <div className="ui-card rounded-3xl border border-[color:var(--cx-border)] bg-[color:var(--cx-surface,#fff)] p-5 text-sm">
            <p className="font-semibold text-[color:var(--cx-textPrimary)]">
              {await serverT("myBookings.claimPending")}
            </p>
            <p className="mt-1 text-xs text-[color:var(--cx-textSecondary)]">
              {await serverT("myBookings.claimPendingHint")}
            </p>
            <Link
              href={bookingDetailClaimPath(claimToken)}
              className="ui-press cx-accent-cta mt-4 inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold"
            >
              {await serverT("myBookings.claimAction")}
            </Link>
          </div>
        ) : null}
        {bookings.length === 0 ? (
          <div className="ui-card rounded-3xl bg-[color:var(--cx-surface,#fff)] p-5 text-sm text-[color:var(--cx-textSecondary)]">
            <p>{await serverT("myBookings.empty")}</p>
            <p className="mt-1 text-xs">{await serverT("myBookings.emptyHint")}</p>
            <Link
              href={`/s/${slug}?book=1`}
              className="ui-press cx-accent-cta mt-4 inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold"
            >
              {await serverT("myBookings.bookNow")}
            </Link>
          </div>
        ) : (
          bookings.map((booking) => (
            <Link
              key={booking.id}
              href={
                booking.securePublicToken
                  ? `/booking/${booking.securePublicToken}`
                  : `/s/${slug}/bookings/${booking.id}`
              }
              className="ui-card block rounded-3xl bg-[color:var(--cx-surface,#fff)] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[color:var(--cx-textPrimary)]">{booking.bookingCode}</p>
                <span className="rounded-full bg-[color:var(--store-primary-soft,#E8F0EF)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--store-primary)]">
                  {translate(locale, customerStatusMessageKey(booking.status))}
                </span>
              </div>
              <p className="mt-1 text-sm text-[color:var(--cx-textSecondary)]">
                {SERVICE_TYPE_LABELS[booking.serviceType] ?? booking.serviceType}
                {" · "}
                {formatThaiDate(booking.startDate)}
                {booking.startTime ? ` ${booking.startTime}` : ""}
              </p>
              <p className="mt-1 text-sm text-[color:var(--cx-textPrimary)]">
                {booking.pickupLocation}
                {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
              </p>
            </Link>
          ))
        )}
      </main>
    </CustomerExperienceShell>
  );
}
