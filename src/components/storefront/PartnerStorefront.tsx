"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StoreLogo } from "@/components/brand/StoreBrand";
import { BookingWizard } from "@/components/storefront/BookingWizard";
import { CustomerExperienceShell } from "@/components/storefront/CustomerExperienceShell";
import { FeaturedTripPackages } from "@/components/storefront/FeaturedTripPackages";
import { PartnerCustomerNav } from "@/components/storefront/PartnerCustomerNav";
import { PartnerTravelDiscovery } from "@/components/storefront/PartnerTravelDiscovery";
import { ServiceTypeIcon } from "@/components/storefront/ServiceTypeIcon";
import {
  emptyBookingDraft,
  isMultiDayService,
  readBookingDraft,
  writeBookingDraft,
  type BookingDraft,
} from "@/lib/booking/draft";
import { resolveBookingPresentation } from "@/lib/domain/booking-presentation";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";
import type { TripPackage } from "@/lib/domain/trip-package";
import type { BookingSource, ServiceType } from "@/lib/domain/enums";
import type {
  Business,
  BusinessSettings,
  Place,
  Province,
  Region,
  Vehicle,
} from "@/lib/domain/types";

const SERVICE_KEYS: { type: ServiceType; labelKey: string; hintKey: string }[] = [
  { type: "AIRPORT_TRANSFER", labelKey: "home.service.airport", hintKey: "home.service.airportHint" },
  { type: "POINT_TO_POINT", labelKey: "home.service.point", hintKey: "home.service.pointHint" },
  { type: "PRIVATE_DRIVER_DAILY", labelKey: "home.service.daily", hintKey: "home.service.dailyHint" },
  { type: "MULTI_DAY_TRIP", labelKey: "home.service.multi", hintKey: "home.service.multiHint" },
];

type Prefill = { name?: string; phone?: string };

export type PartnerStorefrontProps = {
  slug: string;
  business: Business;
  settings: BusinessSettings | null;
  vehicles: Vehicle[];
  places: Place[];
  region: Region | null;
  province: Province | null;
  /** Published packages only — empty when the plan is not entitled. */
  tripPackages?: TripPackage[];
  initialSource?: BookingSource;
  prefill?: Prefill;
  loggedIn?: boolean;
  /** storefront.multilingualUi entitlement — resolved from the plan on the server. */
  multilingual?: boolean;
};

/**
 * Partner storefront: booking CTA first, compact travel preview below.
 * Booking wizard opens via ?book=1 — discovery never interrupts checkout.
 */
export function PartnerStorefront(props: PartnerStorefrontProps) {
  const search = useSearchParams();
  const bookMode =
    search.get("book") === "1" ||
    search.get("book") === "true" ||
    search.get("start") === "1";
  const brand = resolveCustomerStorefrontBranding(props.business);

  if (bookMode) {
    return (
      <CustomerExperienceShell
        brand={brand}
        storeSlug={props.slug}
        multilingual={props.multilingual}
      >
        <BookingWizard {...props} />
      </CustomerExperienceShell>
    );
  }

  return (
    <CustomerExperienceShell
      brand={brand}
      storeSlug={props.slug}
      multilingual={props.multilingual}
      className="min-h-dvh"
    >
      <PartnerStoreHome {...props} />
    </CustomerExperienceShell>
  );
}

function PartnerStoreHome({
  slug,
  business,
  settings,
  places,
  region,
  province,
  tripPackages = [],
  loggedIn = false,
  prefill,
}: PartnerStorefrontProps) {
  const router = useRouter();
  const { t, locale } = useCustomerPrefs();
  const brand = resolveCustomerStorefrontBranding(business);
  const presentation = resolveBookingPresentation({ business, province, region });
  const [draftHint] = useState(() => {
    const draft = readBookingDraft(slug);
    return Boolean(draft && (draft.startDate || draft.pickup || draft.placeIds.length));
  });

  const locationLabel = presentation.placeLabel;
  const availableServices = useMemo(() => SERVICE_KEYS, []);
  const showCmsTagline =
    locale === "th" &&
    Boolean(presentation.displayTagline) &&
    presentation.displayTagline !== t("storefront.heroTitle", { place: locationLabel });

  function startBooking(serviceType?: ServiceType) {
    if (serviceType) {
      const existing =
        readBookingDraft(slug) ??
        emptyBookingDraft({
          name: prefill?.name || "",
          phone: prefill?.phone || "",
        });
      const next: BookingDraft = {
        ...existing,
        serviceType,
        multiDay: isMultiDayService(serviceType),
        step: 1,
      };
      writeBookingDraft(slug, next);
    }
    router.push(`/s/${slug}?book=1`);
  }

  return (
    <>
      <header className="relative overflow-hidden text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={presentation.hero.desktopUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: presentation.hero.objectPositionDesktop }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-[color:var(--store-primary,#0F3D3E)]/55 to-[color:var(--store-primary,#0F3D3E)]/92" />
        <div className="relative mx-auto max-w-[820px] px-4 pb-10 pt-3 md:px-5">
          <div className="flex items-center gap-2.5">
            <StoreLogo brand={brand} size={36} className="bg-white shadow-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{brand.businessName}</p>
              <p className="truncate text-[11px] text-white/75">{locationLabel}</p>
            </div>
          </div>

          <div className="mt-3">
            <PartnerCustomerNav
              slug={slug}
              loggedIn={loggedIn}
              active="home"
              showPackages={tripPackages.length > 0}
            />
          </div>

          <div className="mt-7 max-w-md space-y-3">
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight md:text-[1.9rem]">
              {t("storefront.heroTitle", { place: locationLabel })}
            </h1>
            {showCmsTagline ? (
              <p className="text-sm text-white/85">{presentation.displayTagline}</p>
            ) : null}
            <p className="text-sm text-white/80">{t("storefront.heroSubtitle")}</p>
            <button
              type="button"
              onClick={() => startBooking()}
              className="booking-cta-gold mt-2 w-full max-w-sm"
            >
              {draftHint ? t("storefront.continueBooking") : t("storefront.bookNow")}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-5 max-w-[820px] space-y-8 px-4 pb-16 md:px-5">
        <FeaturedTripPackages packages={tripPackages} storeSlug={slug} mode="preview" />

        <section className="ui-card rounded-[1.5rem] bg-[color:var(--cx-surface,#fff)] p-4 shadow-sm md:p-5">
          <h2 className="text-base font-semibold text-[color:var(--cx-textPrimary)]">
            {t("booking.selectService")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {availableServices.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => startBooking(item.type)}
                className="ui-press flex min-h-[4.5rem] flex-col items-start gap-2 rounded-[1.1rem] bg-[color:var(--store-paper,#F7F4EF)] px-3 py-3 text-left dark:bg-[color:var(--cx-surfaceElevated)]"
              >
                <span className="booking-service-icon bg-[color:var(--cx-surface,#fff)] text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]">
                  <ServiceTypeIcon type={item.type} />
                </span>
                <span>
                  <span className="block text-sm font-semibold leading-snug text-[color:var(--cx-textPrimary)]">
                    {t(item.labelKey)}
                  </span>
                  <span className="block text-[11px] text-[color:var(--cx-textSecondary)]">
                    {t(item.hintKey)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <PartnerTravelDiscovery
          places={places}
          provinceId={business.provinceId}
          storeSlug={slug}
          locationLabel={locationLabel}
          mode="preview"
        />

        <section className="ui-card rounded-[1.25rem] bg-[color:var(--cx-surface,#fff)] px-4 py-4 text-center shadow-sm md:px-5 md:py-5">
          <p className="text-sm font-medium text-[color:var(--cx-textPrimary)]">
            {t("storefront.readyTitle")}
          </p>
          <div className="mt-3 flex flex-col items-stretch justify-center gap-2 sm:mx-auto sm:max-w-md sm:flex-row">
            <button
              type="button"
              onClick={() => startBooking()}
              className="booking-cta-primary h-12 w-full flex-1 sm:min-w-0"
            >
              {draftHint ? t("storefront.continueBooking") : t("storefront.bookNow")}
            </button>
            <Link
              href={`/s/${slug}/travel`}
              className="ui-press inline-flex h-12 w-full flex-1 items-center justify-center rounded-full bg-[color:var(--store-primary-soft,#E8F0EF)] text-sm font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))] sm:min-w-0"
            >
              {t("nav.travel")} →
            </Link>
          </div>
          {settings?.bookingNotes ? (
            <p className="mx-auto mt-3 max-w-md text-xs text-[color:var(--cx-textSecondary)]">
              {settings.bookingNotes}
            </p>
          ) : null}
        </section>
      </main>
    </>
  );
}
