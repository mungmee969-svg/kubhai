import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CustomerExperienceShell } from "@/components/storefront/CustomerExperienceShell";
import { PartnerCustomerNav } from "@/components/storefront/PartnerCustomerNav";
import { StoreLogo } from "@/components/brand/StoreBrand";
import { partnerLoginHref } from "@/lib/auth/customer-auth-links";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import { allowsCustomerLocales } from "@/lib/domain/booking-entitlements";
import { formatThaiDate } from "@/lib/domain/ops";
import { customerStatusLabel } from "@/lib/domain/status-ui";
import { SERVICE_TYPE_LABELS } from "@/lib/domain/enums";
import { serverT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function PartnerBookingDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const store = await getStore().getPublicStore(slug);
  if (!store) notFound();

  const session = await getCustomerSession();
  if (!session) {
    redirect(partnerLoginHref(slug, `/s/${slug}/bookings/${id}`));
  }

  const record = await getStore().getCustomerBookingRecord(session.customerAccountId, id);
  if (!record || record.booking.businessId !== store.business.id) notFound();

  const brand = resolveCustomerStorefrontBranding(store.business);
  const multilingual = allowsCustomerLocales(store.business.subscriptionPlan);
  const booking = record.booking;
  const [detailTitle, backLink] = await Promise.all([
    serverT("myBookings.detail"),
    serverT("myBookings.back"),
  ]);

  // Prefer secure token page for full quotation/payment UX when available
  if (booking.securePublicToken) {
    redirect(`/booking/${booking.securePublicToken}`);
  }

  return (
    <CustomerExperienceShell
      brand={brand}
      storeSlug={slug}
      multilingual={multilingual}
      className="min-h-dvh"
    >
      <header className="bg-[color:var(--store-primary,#0F3D3E)] text-white">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center gap-2.5">
            <StoreLogo brand={brand} size={36} className="bg-white" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{brand.businessName}</p>
              <p className="text-[11px] text-white/75">{detailTitle}</p>
            </div>
          </div>
          <div className="mt-3">
            <PartnerCustomerNav slug={slug} loggedIn active="account" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Link href={`/s/${slug}/bookings`} className="text-sm text-[color:var(--cx-brandFg,var(--store-primary))]">
          {backLink}
        </Link>
        <div className="ui-card rounded-3xl bg-[color:var(--cx-surface,#fff)] p-5">
          <p className="font-mono text-sm font-semibold">{booking.bookingCode}</p>
          <p className="mt-2 text-sm">{customerStatusLabel(booking.status)}</p>
          <p className="mt-2 text-sm text-[color:var(--cx-textSecondary)]">
            {SERVICE_TYPE_LABELS[booking.serviceType]} · {formatThaiDate(booking.startDate)}{" "}
            {booking.startTime ?? ""}
          </p>
          <p className="mt-2 text-sm">
            {booking.pickupLocation}
            {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
          </p>
        </div>
      </main>
    </CustomerExperienceShell>
  );
}
