"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  emptyBookingDraft,
  readBookingDraft,
  writeBookingDraft,
  type BookingDraft,
} from "@/lib/booking/draft";
import {
  mapPackageToBookingDraftPrefill,
  type TripPackage,
} from "@/lib/domain/trip-package";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";

/**
 * Prefills the existing Quick Booking draft from a package and hands off to the
 * one and only booking wizard at /s/{slug}?book=1. Never prices or confirms.
 */
export function BookPackageButton({
  pkg,
  storeSlug,
}: {
  pkg: TripPackage;
  storeSlug: string;
}) {
  const router = useRouter();
  const { t, locale } = useCustomerPrefs();
  const [pending, setPending] = useState(false);

  function startBooking() {
    if (pending) return;
    setPending(true);
    const previous = readBookingDraft(storeSlug);
    // A package starts a new trip intent. Preserve customer identity only so
    // stale dates, routes, or vehicle choices cannot leak from another draft.
    const base = emptyBookingDraft(
      previous
        ? {
            name: previous.name,
            phone: previous.phone,
            email: previous.email,
            customerType: previous.customerType,
            companyName: previous.companyName,
            taxId: previous.taxId,
          }
        : undefined,
    );
    const next: BookingDraft = {
      ...base,
      ...mapPackageToBookingDraftPrefill(pkg, locale),
      // Straight to travel details — service type comes from the package.
      step: 2,
    };
    writeBookingDraft(storeSlug, next);
    router.push(`/s/${storeSlug}?book=1`);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startBooking}
        disabled={pending}
        className="booking-cta-primary h-12 w-full disabled:opacity-70"
      >
        {pending ? t("package.preparingBooking") : t("package.bookThis")}
      </button>
      <p className="text-center text-[11px] leading-4 text-[color:var(--cx-textSecondary)]">
        {t("package.quoteHint")}
      </p>
    </div>
  );
}
