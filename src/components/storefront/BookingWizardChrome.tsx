/**
 * Booking chrome — location travel hero + Partner brand overlay.
 * Theme never forks booking business logic.
 */

"use client";

import Link from "next/link";
import type { BookingWizardStep } from "@/lib/booking/draft";
import type { BookingPresentation } from "@/lib/domain/booking-presentation";
import { accessibleOnPrimary } from "@/lib/domain/booking-presentation";
import { CustomerStoreIdentityLink } from "@/components/brand/CustomerStoreIdentityLink";
import { BookingProgress } from "@/components/storefront/BookingProgress";
import { CustomerMobilePrefsButton } from "@/components/storefront/CustomerPrefsControls";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";
import { storefrontPath } from "@/lib/domain/storefront-url";

export function bookingAtmosphereClass(step: BookingWizardStep): string {
  if (step <= 2) return "booking-atm-trip";
  if (step === 3) return "booking-atm-fleet";
  if (step === 4) return "booking-atm-calm";
  return "booking-atm-review";
}

export function BookingWizardChrome({
  presentation,
  step,
  onHelp,
  children,
  stickyCta,
  desktopAside,
  footer,
}: {
  presentation: BookingPresentation;
  step: BookingWizardStep;
  onHelp: () => void;
  children: React.ReactNode;
  stickyCta: React.ReactNode;
  desktopAside?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useCustomerPrefs();
  const { brand, hero, displayTagline, placeLabel } = presentation;
  const onPrimary = accessibleOnPrimary(brand.primaryColor);
  const tagline = displayTagline || t("booking.taglineFallback", { place: placeLabel });
  const showPhotoAccent = hero.source !== "generic" && !hero.desktopUrl.endsWith(".svg");

  return (
    <div
      className={`booking-shell min-h-dvh text-[color:var(--store-ink,#0F1724)] ${bookingAtmosphereClass(step)}`}
    >
      <div className="booking-shell-bg" aria-hidden />

      <header
        className="relative overflow-hidden booking-hero-compact text-white"
        style={
          {
            ["--booking-hero-pos-d" as string]: hero.objectPositionDesktop,
            ["--booking-hero-pos-m" as string]: hero.objectPositionMobile,
          } as React.CSSProperties
        }
      >
        <picture>
          {hero.mobileUrl !== hero.desktopUrl ? (
            <source media="(max-width: 767px)" srcSet={hero.mobileUrl} />
          ) : null}
          <img
            src={hero.desktopUrl}
            alt=""
            className="booking-hero-photo absolute inset-0 h-full w-full object-cover"
            data-hero-source={hero.source}
          />
        </picture>
        <div className="booking-hero-overlay absolute inset-0" />
        {!showPhotoAccent ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/booking/chiang-mai-silhouette.svg"
            alt=""
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full object-cover object-bottom opacity-50 md:h-20"
          />
        ) : null}
        <div
          className="relative mx-auto max-w-5xl px-4 pt-3 md:px-5 md:pt-4"
          style={{ color: onPrimary.ink }}
        >
          <div className="flex items-center justify-between gap-3">
            <CustomerStoreIdentityLink
              brand={brand}
              storeSlug={brand.slug}
              subtitle={placeLabel}
              subtitleClassName="text-white/75"
            />
            <div className="booking-header-actions flex items-center gap-2">
              <CustomerMobilePrefsButton />
              <button
                type="button"
                onClick={onHelp}
                className="booking-header-action booking-header-action--secondary"
              >
                {t("common.help")}
              </button>
            </div>
          </div>
          <Link
            href={storefrontPath(brand.slug)}
            className="mt-3 inline-flex min-h-10 items-center text-xs font-semibold text-white/85 underline-offset-4 hover:underline"
          >
            {t("booking.storeHome")}
          </Link>

          {step === 1 ? (
            <div className="pb-9 pt-5 md:pb-10 md:pt-6">
              <p className="max-w-[17rem] whitespace-pre-line text-[1.35rem] font-semibold leading-[1.3] tracking-tight md:max-w-md md:text-[1.65rem]">
                {tagline}
              </p>
            </div>
          ) : (
            <div className="pb-7 pt-2" />
          )}
        </div>
      </header>

      <div className="relative z-10 -mt-5 md:-mt-6">
        <div className="mx-auto max-w-5xl px-3 md:px-5">
          <div className="booking-progress-pill mx-auto mb-3 max-w-lg px-3 py-2.5 md:max-w-none">
            <BookingProgress step={step} variant="sheet" />
          </div>
        </div>

        <div className="booking-sheet mx-auto max-w-[820px] overflow-hidden md:rounded-[2rem] md:mb-8">
          <div className="mx-auto grid gap-8 px-4 pb-28 pt-5 md:px-6 md:pt-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(240px,0.32fr)] lg:pb-10">
            <div
              key={step}
              className="booking-card-enter mx-auto w-full max-w-[760px] space-y-5 lg:mx-0"
            >
              {children}
            </div>
            {desktopAside ? (
              <aside className="hidden lg:block">
                <div className="booking-summary-card sticky top-6 space-y-4 p-5">{desktopAside}</div>
              </aside>
            ) : null}
          </div>
          {footer ? (
            <div className="border-t border-black/[0.04] px-4 py-6 text-center md:px-6">{footer}</div>
          ) : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="booking-sticky-cta mx-auto max-w-lg px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
          {stickyCta}
        </div>
      </div>
    </div>
  );
}
