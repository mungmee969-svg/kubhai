"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContactStoreLinks } from "@/components/brand/StoreBrand";
import {
  CompactLocationField,
  LocationPickerSheet,
} from "@/components/location/LocationPickerSheet";
import { BookingWizardChrome } from "@/components/storefront/BookingWizardChrome";
import { BookingTimeField } from "@/components/storefront/BookingTimeField";
import { MultiDayOverview } from "@/components/storefront/MultiDayOverview";
import { StoreTipsCard } from "@/components/storefront/StoreTipsCard";
import { TripPlannerSheet } from "@/components/storefront/TripPlannerSheet";
import { VehicleGallerySheet } from "@/components/storefront/VehicleGallerySheet";
import { submitBookingRequest } from "@/lib/actions/booking";
import { trackPublicEvent } from "@/lib/actions/analytics";
import { sourceFromSearch } from "@/lib/analytics/source";
import {
  clearBookingDraft,
  displayVehicleName,
  emptyBookingDraft,
  isMultiDayService,
  readBookingDraft,
  writeBookingDraft,
  BOOKING_WIZARD_MAX_STEP,
  type BookingDraft,
  type BookingWizardStep,
} from "@/lib/booking/draft";
import {
  buildBookingSubmitPayload,
  firstIssueStep,
  logBookingValidationFailure,
  reviewSectionWarnings,
  summarizeIssues,
  type BookingFieldIssue,
} from "@/lib/booking/submit";
import {
  buildDaysFromDuration,
  derivedEndDate,
  formatThaiDateRange,
  formatThaiShortDate,
  resolveDayStart,
  type DayPlan,
} from "@/lib/booking/itinerary";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import { resolveBookingPresentation } from "@/lib/domain/booking-presentation";
import { resolveVehicleCoverUrl, resolveVehicleGallery } from "@/lib/domain/vehicle-image";
import { localizedPackageText, type TripPackage } from "@/lib/domain/trip-package";
import { packagePriceLabel } from "@/components/storefront/TripPackageCard";
import { ServiceTypeIcon } from "@/components/storefront/ServiceTypeIcon";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";
import { customerLocationAddress, customerLocationTitle } from "@/lib/location/display";
import type { BookingSource, ServiceType } from "@/lib/domain/enums";
import type {
  Business,
  BusinessSettings,
  Place,
  Province,
  Region,
  Vehicle,
} from "@/lib/domain/types";

const SERVICE_OPTION_KEYS: { type: ServiceType; labelKey: string; hintKey: string }[] = [
  { type: "AIRPORT_TRANSFER", labelKey: "home.service.airport", hintKey: "booking.service.airportHint" },
  { type: "POINT_TO_POINT", labelKey: "home.service.point", hintKey: "booking.service.pointHint" },
  { type: "PRIVATE_DRIVER_DAILY", labelKey: "home.service.daily", hintKey: "booking.service.dailyHint" },
  { type: "MULTI_DAY_TRIP", labelKey: "home.service.multi", hintKey: "booking.service.multiHint" },
];

const FAQ_KEYS = [
  { q: "booking.faq.fuel.q", a: "booking.faq.fuel.a" },
  { q: "booking.faq.toll.q", a: "booking.faq.toll.a" },
  { q: "booking.faq.parking.q", a: "booking.faq.parking.a" },
  { q: "booking.faq.overtime.q", a: "booking.faq.overtime.a" },
  { q: "booking.faq.cancel.q", a: "booking.faq.cancel.a" },
  { q: "booking.faq.childSeat.q", a: "booking.faq.childSeat.a" },
] as const;

type Prefill = { name?: string | null; phone?: string | null };

type Props = {
  slug: string;
  business: Business;
  settings: BusinessSettings | null;
  vehicles: Vehicle[];
  places: Place[];
  region: Region | null;
  province: Province | null;
  tripPackages?: TripPackage[];
  initialSource?: BookingSource;
  prefill?: Prefill;
  loggedIn?: boolean;
};

export function BookingWizard({
  slug,
  business,
  settings,
  vehicles,
  places,
  region,
  province,
  tripPackages = [],
  initialSource = "DIRECT",
  prefill,
  loggedIn: _loggedIn = false,
}: Props) {
  void _loggedIn; // Pilot: guest booking — login prop retained for callers, unused
  const { t, locale } = useCustomerPrefs();
  const router = useRouter();
  const brand = resolveCustomerStorefrontBranding(business);
  const presentation = resolveBookingPresentation({ business, province, region });
  const [draft, setDraft] = useState<BookingDraft>(() =>
    emptyBookingDraft({
      name: prefill?.name || "",
      phone: prefill?.phone || "",
    }),
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<BookingFieldIssue[]>([]);
  const [pending, setPending] = useState(false);
  const [started, setStarted] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [dropoffOpen, setDropoffOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const saved = readBookingDraft(slug);
    const frame = window.requestAnimationFrame(() => {
      if (saved) {
        setDraft(
          emptyBookingDraft({
            ...saved,
            name: saved.name || prefill?.name || "",
            phone: saved.phone || prefill?.phone || "",
          }),
        );
      }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [slug, prefill?.name, prefill?.phone]);

  useEffect(() => {
    if (!ready) return;
    writeBookingDraft(slug, draft);
  }, [draft, ready, slug]);

  function update(partial: Partial<BookingDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    markStarted();
  }

  function go(step: BookingWizardStep) {
    update({ step });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markStarted() {
    if (started) return;
    setStarted(true);
    void trackPublicEvent({
      businessId: business.id,
      sessionId: window.sessionStorage.getItem("kh_session_id") ?? "anon",
      eventName: "booking_started",
    });
  }

  function validateStep1(): string | null {
    if (!draft.serviceType) return t("booking.needService");
    return null;
  }

  function validateStep2(): string | null {
    if (!draft.startDate) return t("booking.err.needDate");
    if (isMultiDayService(draft.serviceType)) {
      if (!draft.numberOfDays || draft.numberOfDays < 1) return t("booking.err.needDays");
      const days =
        draft.days.length === draft.numberOfDays
          ? draft.days
          : buildDaysFromDuration(draft.startDate, draft.numberOfDays, draft.days);
      if (!days[0]?.startLocation?.label?.trim()) {
        return t("booking.err.needDay1Pickup");
      }
      if (!days[days.length - 1]?.endLocation?.label?.trim()) {
        return t("booking.err.needFinalDropoff");
      }
      return null;
    }
    if (!draft.pickup?.label?.trim()) return t("booking.err.needPickup");
    if (!draft.dropoff?.label?.trim()) return t("booking.err.needDropoff");
    return null;
  }

  function validateStep3(): string | null {
    if (!draft.letStoreChooseVehicle && !draft.preferredVehicleId) {
      return t("booking.err.needVehicle");
    }
    return null;
  }

  function validateStep4(): string | null {
    if (!draft.name.trim() || draft.name.trim().length < 2) return t("booking.err.needName");
    if (!draft.phone.trim() || draft.phone.trim().length < 8) return t("booking.err.needPhone");
    return null;
  }

  function nextFrom(step: BookingWizardStep) {
    setError(null);
    setIssues([]);
    const validators: Partial<Record<BookingWizardStep, () => string | null>> = {
      1: validateStep1,
      2: validateStep2,
      3: validateStep3,
      4: validateStep4,
    };
    const err = validators[step]?.() ?? null;
    if (err) {
      setError(err);
      return;
    }
    if (step < BOOKING_WIZARD_MAX_STEP) go((step + 1) as BookingWizardStep);
  }

  async function submitRequest() {
    if (pending) return;
    setError(null);
    setIssues([]);
    const errCustomer = validateStep4();
    if (errCustomer) {
      setError(errCustomer);
      return;
    }
    const source =
      sourceFromSearch(window.location.search) === "DIRECT"
        ? initialSource
        : sourceFromSearch(window.location.search);
    const built = buildBookingSubmitPayload(slug, draft, source);
    if (!built.ok) {
      logBookingValidationFailure(built.issues);
      setIssues(built.issues);
      setError(built.error);
      return;
    }
    setPending(true);
    const result = await submitBookingRequest(built.payload);
    if (!result.ok) {
      setPending(false);
      if (result.issues?.length) {
        logBookingValidationFailure(result.issues);
        setIssues(result.issues);
        setError(result.error || summarizeIssues(result.issues));
      } else {
        setError(result.error);
      }
      return;
    }
    window.sessionStorage.setItem(
      "kh_last_booking",
      JSON.stringify({ token: result.token, code: result.bookingCode }),
    );
    window.sessionStorage.removeItem("kh_booking_request_id");
    clearBookingDraft(slug);
    router.push(`/booking/${result.token}/success`);
  }

  const multi = isMultiDayService(draft.serviceType);
  const selectedVehicle = vehicles.find((v) => v.id === draft.preferredVehicleId);
  const selectedPackage = tripPackages.find((item) => item.id === draft.tripPackageId);
  const isReview = draft.step === BOOKING_WIZARD_MAX_STEP;
  const ctaLabel = isReview ? t("booking.submit") : t("auth.continue");

  return (
    <div className="min-h-dvh">
      <BookingWizardChrome
        presentation={presentation}
        step={draft.step}
        onHelp={() => setFaqOpen(true)}
        stickyCta={
          <div className="space-y-2">
            {isReview ? (
              <p className="text-center text-[11px] leading-4 text-muted">
                {t("booking.quotePending")}
              </p>
            ) : null}
            <div className="flex gap-2">
              {draft.step > 1 ? (
                <button
                  type="button"
                  onClick={() => go((draft.step - 1) as BookingWizardStep)}
                  className="flex h-[3.15rem] min-w-[5.5rem] items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[color:var(--store-ink,#0F1724)] shadow-sm"
                >
                  {t("common.back")}
                </button>
              ) : (
                <Link
                  href={`/s/${slug}`}
                  className="flex h-[3.15rem] min-w-[5.5rem] items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[color:var(--store-ink,#0F1724)] shadow-sm"
                >
                  {t("booking.storeHome")}
                </Link>
              )}
              <PrimaryCta
                className="flex-1"
                label={ctaLabel}
                pending={pending && isReview}
                tone={isReview ? "primary" : "gold"}
                onClick={() => (isReview ? void submitRequest() : nextFrom(draft.step))}
              />
            </div>
          </div>
        }
        desktopAside={
          <>
            <p className="text-xs font-medium text-muted">{t("booking.summary")}</p>
            <SummaryBits draft={draft} vehicle={selectedVehicle} multi={multi} />
            <StoreTipsCard
              compact
              storeName={brand.shortName || brand.businessName}
              tips={settings?.tips ?? []}
              serviceType={draft.serviceType}
              pickupLocation={draft.pickup?.label ?? draft.pickup?.address ?? null}
              dropoffLocation={draft.dropoff?.label ?? draft.dropoff?.address ?? null}
              passengerCount={draft.passengers}
              luggageCount={draft.luggage}
              multiDay={multi}
              surface="WIZARD"
            />
            <p className="text-xs leading-5 text-muted">
              {t("booking.quoteNotConfirm")}
            </p>
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="text-xs font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
            >
              {t("common.contactStore")}
            </button>
          </>
        }
        footer={
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
              <button type="button" onClick={() => setFaqOpen(true)} className="text-muted">
                {t("booking.faq")}
              </button>
              <button type="button" onClick={() => setContactOpen(true)} className="text-muted">
                {t("common.contactStore")}
              </button>
              <Link href={`/s/${slug}/bookings`} className="text-muted">
                {t("nav.myBookings")}
              </Link>
            </div>
            {settings?.bookingNotes ? (
              <p className="text-[11px] text-muted">{settings.bookingNotes}</p>
            ) : null}
          </div>
        }
      >
        {selectedPackage ? (
          <div className="rounded-2xl bg-[color:var(--store-primary-soft,#E8F0EF)] px-4 py-3 text-sm text-[color:var(--cx-textPrimary)]">
            <p className="text-xs text-[color:var(--cx-textSecondary)]">
              {t("package.detail")}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {localizedPackageText(locale, selectedPackage.title)}
              </p>
              <p className="text-xs font-semibold">
                {packagePriceLabel(selectedPackage, t).label}
              </p>
            </div>
          </div>
        ) : null}
        {draft.step > 1 ? (
          <button
            type="button"
            onClick={() => go((draft.step - 1) as BookingWizardStep)}
            className="hidden text-sm font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))] lg:inline-flex"
          >
            {t("booking.backArrow")}
          </button>
        ) : null}

        {draft.step === 1 ? (
          <CardService draft={draft} update={update} />
        ) : null}

        {draft.step === 2 ? (
          <CardTravelDetails
            draft={draft}
            update={update}
            multi={multi}
            onOpenPickup={() => setPickupOpen(true)}
            onOpenDropoff={() => setDropoffOpen(true)}
            onOpenPlanner={() => setPlannerOpen(true)}
          />
        ) : null}

        {draft.step === 3 ? (
          <StepVehicle
            draft={draft}
            vehicles={vehicles}
            update={update}
            multi={multi}
            onOpenPlanner={() => setPlannerOpen(true)}
            shortName={brand.shortName}
          />
        ) : null}

        {draft.step === 4 ? (
          <StepCustomer
            draft={draft}
            update={update}
            multi={multi}
            onOpenPlanner={() => setPlannerOpen(true)}
            onEditTrip={() => go(2)}
            storeName={brand.shortName || brand.businessName}
          />
        ) : null}

        {draft.step === 5 ? (
          <StepReview
            draft={draft}
            scenicUrl={presentation.hero.desktopUrl}
            selectedVehicle={selectedVehicle}
            places={places}
            multi={multi}
            onEdit={go}
            issues={issues}
          />
        ) : null}

        {error ? (
          <div className="space-y-2 rounded-2xl border border-danger/20 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-medium text-danger">{error}</p>
            {issues.length ? (
              <ul className="space-y-1 text-sm text-danger">
                {issues.slice(0, 4).map((item) => (
                  <li key={`${item.path}-${item.code}`}>• {item.message}</li>
                ))}
              </ul>
            ) : null}
            {isReview && issues.length ? (
              <button
                type="button"
                onClick={() => go(firstIssueStep(issues))}
                className="text-sm font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
              >
                {t("booking.fixEdit")}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="hidden lg:block">
          <PrimaryCta
            label={ctaLabel}
            pending={pending && isReview}
            tone={isReview ? "primary" : "gold"}
            onClick={() => (isReview ? void submitRequest() : nextFrom(draft.step))}
          />
        </div>
      </BookingWizardChrome>

      {pickupOpen ? (
        <LocationPickerSheet
          key="pickup"
          open
          title={t("booking.specifyPickup")}
          value={draft.pickup}
          onClose={() => setPickupOpen(false)}
          onSelect={(pickup) => update({ pickup })}
        />
      ) : null}
      {dropoffOpen ? (
        <LocationPickerSheet
          key="dropoff"
          open
          title={t("booking.specifyDropoff")}
          value={draft.dropoff}
          onClose={() => setDropoffOpen(false)}
          onSelect={(dropoff) => update({ dropoff })}
        />
      ) : null}
      {plannerOpen && !multi ? (
        <TripPlannerSheet
          places={places}
          selectedIds={draft.placeIds}
          letStorePlan={draft.letStorePlanTrip}
          onClose={() => setPlannerOpen(false)}
          onChange={(placeIds, letStorePlanTrip) => update({ placeIds, letStorePlanTrip })}
        />
      ) : null}
      <FaqSheet open={faqOpen} onClose={() => setFaqOpen(false)} />
      <ContactSheet open={contactOpen} onClose={() => setContactOpen(false)} brand={brand} />
    </div>
  );
}

function PrimaryCta({
  label,
  onClick,
  pending,
  tone = "gold",
  className = "",
}: {
  label: string;
  onClick: () => void;
  pending?: boolean;
  tone?: "gold" | "primary";
  className?: string;
}) {
  const { t } = useCustomerPrefs();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`${tone === "primary" ? "booking-cta-primary" : "booking-cta-gold"} ${className}`}
    >
      {pending ? t("booking.submitting") : label}
    </button>
  );
}

function selectService(type: ServiceType, draft: BookingDraft): Partial<BookingDraft> {
  if (isMultiDayService(type)) {
    const n = draft.numberOfDays || 3;
    const days = buildDaysFromDuration(draft.startDate, n, draft.days);
    return {
      serviceType: type,
      multiDay: true,
      numberOfDays: n,
      days,
      endDate: draft.startDate ? derivedEndDate(draft.startDate, n) : "",
    };
  }
  return { serviceType: type, multiDay: false };
}

function CardService({
  draft,
  update,
}: {
  draft: BookingDraft;
  update: (p: Partial<BookingDraft>) => void;
}) {
  const { t } = useCustomerPrefs();
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[1.45rem] font-semibold tracking-tight md:text-2xl">
          {t("booking.selectService")}
        </h1>
        <p className="mt-1 text-sm leading-6 text-muted">{t("booking.formHint")}</p>
      </div>
      <div className="space-y-2.5">
        {SERVICE_OPTION_KEYS.map((option) => {
          const active = draft.serviceType === option.type;
          return (
            <button
              key={option.type}
              type="button"
              data-active={active}
              onClick={() => update(selectService(option.type, draft))}
              className="booking-service-card-lg"
            >
              <span
                className={`booking-service-icon ${
                  active ? "bg-white/15 text-white" : "bg-[color:var(--store-primary-soft,#E7EFEA)] text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
                }`}
                aria-hidden
              >
                <ServiceTypeIcon type={option.type} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-semibold leading-snug">{t(option.labelKey)}</span>
                <span className={`mt-0.5 block text-xs leading-5 ${active ? "text-white/75" : "text-muted"}`}>
                  {t(option.hintKey)}
                </span>
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  active
                    ? "bg-[color:var(--store-accent,#C4A35A)] text-[#1a1510]"
                    : "border-2 border-black/10"
                }`}
                aria-hidden
              >
                {active ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CardTravelDetails({
  draft,
  update,
  multi,
  onOpenPickup,
  onOpenDropoff,
  onOpenPlanner,
}: {
  draft: BookingDraft;
  update: (p: Partial<BookingDraft>) => void;
  multi: boolean;
  onOpenPickup: () => void;
  onOpenDropoff: () => void;
  onOpenPlanner: () => void;
}) {
  const { t } = useCustomerPrefs();
  const dateLabel = draft.startDate ? formatThaiShortDate(draft.startDate) : t("booking.selectDate");
  const endDateLabel = draft.endDate ? formatThaiShortDate(draft.endDate) : "—";
  const airport = draft.serviceType === "AIRPORT_TRANSFER";

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[1.45rem] font-semibold tracking-tight md:text-2xl">
          {t("booking.travelDetails")}
        </h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          {t("booking.travelHint")}
        </p>
      </div>

      {multi ? (
        <MultiDayOverview
          startDate={draft.startDate}
          numberOfDays={draft.numberOfDays}
          days={draft.days}
          letStorePlanTrip={draft.letStorePlanTrip}
          storeHelpInterests={draft.storeHelpInterests}
          onChange={update}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="booking-datetime-card">
              <span className="text-[11px] font-medium text-muted">{t("booking.travelDate")}</span>
              <p className="mt-1 text-sm font-semibold">{dateLabel}</p>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => update({ startDate: e.target.value })}
                aria-label={t("booking.travelDate")}
              />
            </label>
            <BookingTimeField
              label={t("booking.startTime")}
              value={draft.startTime}
              required
              onChange={(startTime) => {
                update({
                  startTime,
                  days:
                    draft.days.length > 0
                      ? draft.days.map((day, index) =>
                          index === 0 ? { ...day, startTime } : day,
                        )
                      : draft.days,
                });
              }}
            />
          </div>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-[1.15rem] bg-white px-4 py-3 shadow-sm">
            <span className="text-sm font-medium">{t("booking.returnOtherDay")}</span>
            <input
              type="checkbox"
              checked={draft.multiDay}
              onChange={(e) => update({ multiDay: e.target.checked })}
              className="h-5 w-5 accent-[color:var(--store-primary,#0F3D3E)]"
            />
          </label>
          {draft.multiDay ? (
            <div className="grid grid-cols-2 gap-2.5">
              <label className="booking-datetime-card">
                <span className="text-[11px] font-medium text-muted">{t("booking.untilDate")}</span>
                <p className="mt-1 text-sm font-semibold">{endDateLabel}</p>
                <input
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => update({ endDate: e.target.value })}
                  aria-label={t("booking.untilDate")}
                />
              </label>
              <BookingTimeField
                label={t("booking.untilTime")}
                value={draft.endTime}
                placeholder="—"
                onChange={(endTime) => {
                  update({
                    endTime,
                    days:
                      draft.days.length > 0
                        ? draft.days.map((day, index) =>
                            index === draft.days.length - 1 ? { ...day, endTime } : day,
                          )
                        : draft.days,
                  });
                }}
              />
            </div>
          ) : null}

          <div className="booking-route-rail space-y-3 pl-1 pt-1">
            <CompactLocationField
              label={t("booking.specifyPickup")}
              required
              value={draft.pickup}
              placeholder={t("booking.searchPlace")}
              onOpen={onOpenPickup}
              onClearNote={() =>
                draft.pickup && update({ pickup: { ...draft.pickup, customerNote: null } })
              }
            />
            <button
              type="button"
              onClick={onOpenPlanner}
              className="ml-10 min-h-11 text-left text-sm font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
            >
              {t("booking.addStop")}
              {draft.placeIds.length ? ` (${draft.placeIds.length})` : ""}
            </button>
            <CompactLocationField
              label={t("booking.specifyDropoff")}
              required
              value={draft.dropoff}
              placeholder={t("booking.searchPlace")}
              onOpen={onOpenDropoff}
              onClearNote={() =>
                draft.dropoff && update({ dropoff: { ...draft.dropoff, customerNote: null } })
              }
            />
          </div>

          {airport ? (
            <details className="rounded-[1.15rem] bg-white px-4 py-3 shadow-sm">
              <summary className="cursor-pointer text-sm font-medium text-[color:var(--store-ink,#0F1724)]">
                {t("booking.flightInfo")}
              </summary>
              <textarea
                className="mt-3 w-full rounded-xl border border-black/10 bg-[color:var(--store-paper,#F7F4EF)] px-3 py-2.5 text-sm outline-none"
                rows={2}
                placeholder={t("booking.flightPlaceholder")}
                value={draft.notes}
                onChange={(e) => update({ notes: e.target.value })}
              />
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

function StepVehicle({
  draft,
  vehicles,
  update,
  multi,
  onOpenPlanner,
  shortName,
}: {
  draft: BookingDraft;
  vehicles: Vehicle[];
  update: (p: Partial<BookingDraft>) => void;
  multi: boolean;
  onOpenPlanner: () => void;
  shortName: string;
}) {
  const { t } = useCustomerPrefs();
  const [galleryVehicle, setGalleryVehicle] = useState<Vehicle | null>(null);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[1.45rem] font-semibold tracking-tight md:text-2xl">
          {t("booking.passengersVehicleTitle")}
        </h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          {t("booking.passengersVehicleHint")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Stepper
          label={t("booking.passengerCount")}
          icon="👤"
          value={draft.passengers}
          min={1}
          max={20}
          onChange={(passengers) => update({ passengers })}
        />
        <Stepper
          label={t("booking.luggageCount")}
          icon="▣"
          value={draft.luggage}
          min={0}
          max={30}
          onChange={(luggage) => update({ luggage })}
        />
      </div>

      <button
        type="button"
        onClick={() => update({ letStoreChooseVehicle: true, preferredVehicleId: null })}
        className={`w-full rounded-[1.25rem] px-4 py-4 text-left shadow-sm ${
          draft.letStoreChooseVehicle
            ? "bg-[color:var(--store-primary,#0F3D3E)] text-white"
            : "bg-white"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden>
            ✨
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("booking.letStoreRecommend")}</p>
            <p className={`mt-1 text-xs leading-5 ${draft.letStoreChooseVehicle ? "text-white/75" : "text-muted"}`}>
              {t("booking.letStoreRecommendHint")}
            </p>
          </div>
          <span
            className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 ${
              draft.letStoreChooseVehicle
                ? "border-[color:var(--store-accent,#C4A35A)] bg-[color:var(--store-accent,#C4A35A)]"
                : "border-black/15"
            }`}
            aria-hidden
          />
        </div>
      </button>

      <div>
        <p className="mb-3 text-[11px] font-medium tracking-wide text-muted">{t("booking.orChooseVehicle")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {vehicles.map((vehicle) => {
            const selected = !draft.letStoreChooseVehicle && draft.preferredVehicleId === vehicle.id;
            const name = displayVehicleName(`${vehicle.brand} ${vehicle.model}`);
            const cover = resolveVehicleCoverUrl(vehicle);
            const galleryCount = resolveVehicleGallery(vehicle).length;
            return (
              <div key={vehicle.id} data-selected={selected} className="booking-vehicle-card overflow-hidden">
                <button type="button" className="relative block w-full" onClick={() => setGalleryVehicle(vehicle)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover} alt={name} className="h-40 w-full object-cover sm:h-36" loading="lazy" />
                  {galleryCount > 1 ? (
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">
                      {t("booking.viewPhotos", { count: galleryCount })}
                    </span>
                  ) : null}
                </button>
                <div className="space-y-2 p-4">
                  <button
                    type="button"
                    onClick={() => update({ letStoreChooseVehicle: false, preferredVehicleId: vehicle.id })}
                    className="w-full space-y-2 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{name}</p>
                      <span
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 ${
                          selected
                            ? "border-[color:var(--store-accent,#C4A35A)] bg-[color:var(--store-accent,#C4A35A)]"
                            : "border-black/15"
                        }`}
                        aria-hidden
                      />
                    </div>
                    <p className="text-sm text-muted">
                      {t("booking.seats", { n: vehicle.seats })}
                      <span className="mx-1.5 text-[color:var(--store-line,#E8E2D8)]">·</span>
                      {t("booking.luggagePieces", { n: vehicle.luggageCapacity })}
                    </p>
                    {vehicle.description ? (
                      <p className="line-clamp-2 text-xs text-muted">{vehicle.description}</p>
                    ) : vehicle.amenities.length ? (
                      <p className="text-xs text-muted">{vehicle.amenities.slice(0, 4).join(" • ")}</p>
                    ) : null}
                    <div className="pt-1">
                      <p className="text-[11px] text-muted">{t("booking.fromPrice")}</p>
                      <p className="text-sm font-semibold">
                        {vehicle.basePrice
                          ? `฿${vehicle.basePrice.toLocaleString("th-TH")}`
                          : t("booking.askStore")}
                        {vehicle.basePrice && vehicle.pricingUnit ? (
                          <span className="font-normal text-muted"> / {vehicle.pricingUnit}</span>
                        ) : null}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryVehicle(vehicle)}
                    className="text-xs font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
                  >
                    {t("vehicle.morePhotos")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">{t("booking.priceConfirm")}</p>
      </div>

      <div className="booking-trust-banner">
        <p className="text-sm font-semibold">{t("booking.trustClean")}</p>
        <p className="mt-0.5 text-xs text-white/75">{t("booking.trustDriver", { store: shortName })}</p>
      </div>

      {!multi ? (
        <OptionalTripAction
          count={draft.placeIds.length}
          letStorePlan={draft.letStorePlanTrip}
          onOpen={onOpenPlanner}
        />
      ) : null}

      {galleryVehicle ? (
        <VehicleGallerySheet
          key={galleryVehicle.id}
          vehicle={galleryVehicle}
          open
          onClose={() => setGalleryVehicle(null)}
        />
      ) : null}
    </section>
  );
}

function StepCustomer({
  draft,
  update,
  multi,
  onOpenPlanner,
  onEditTrip,
  storeName,
}: {
  draft: BookingDraft;
  update: (p: Partial<BookingDraft>) => void;
  multi: boolean;
  onOpenPlanner: () => void;
  onEditTrip: () => void;
  storeName: string;
}) {
  const { t } = useCustomerPrefs();
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[1.45rem] font-semibold tracking-tight md:text-2xl">{t("booking.customerInfo")}</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          {t("booking.customerHint", { store: storeName })}
        </p>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted">👤 {t("booking.name")} *</span>
          <input
            className="wizard-input"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder={t("booking.namePlaceholder")}
            autoComplete="name"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted">📞 {t("booking.phone")} *</span>
          <input
            className="wizard-input"
            value={draft.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="08x xxx xxxx"
            inputMode="tel"
            autoComplete="tel"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted">✉️ {t("booking.email")}</span>
          <input
            className="wizard-input"
            type="email"
            value={draft.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="you@email.com"
            autoComplete="email"
          />
        </label>
        {draft.serviceType === "AIRPORT_TRANSFER" ? (
          <details className="rounded-[1.15rem] bg-white px-4 py-3 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium">
              {t("booking.flightAndNeeds")}
            </summary>
            <textarea
              className="wizard-input mt-3 min-h-[4.5rem] py-3"
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder={t("booking.flightNeedsPlaceholder")}
            />
          </details>
        ) : (
          <details className="rounded-[1.15rem] bg-white px-4 py-3 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium">
              {t("booking.extraNeeds")}
            </summary>
            <textarea
              className="wizard-input mt-3 min-h-[4.5rem] py-3"
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder={t("booking.extraNeedsPlaceholder")}
            />
          </details>
        )}
      </div>

      {multi ? (
        <button
          type="button"
          onClick={onEditTrip}
          className="w-full rounded-[1.15rem] bg-white px-4 py-3 text-left shadow-sm"
        >
          <p className="text-sm font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]">{t("booking.editTripPlan")}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatThaiDateRange(draft.startDate, draft.numberOfDays)} · {t("booking.daysCount", { n: draft.numberOfDays })}
          </p>
        </button>
      ) : (
        <OptionalTripAction
          count={draft.placeIds.length}
          letStorePlan={draft.letStorePlanTrip}
          onOpen={onOpenPlanner}
        />
      )}
    </section>
  );
}

function dayLineSummary(day: DayPlan, previous: DayPlan | null, isLast: boolean): string {
  if (day.undecided) return "ยังไม่วางแผน";
  const start = resolveDayStart(day, previous)?.label;
  const end = day.endLocation?.label;
  const stops = day.stops.length ? ` · ${day.stops.length} จุดแวะ` : "";
  if (start && end) return `${start} → ${end}${stops}`;
  if (start) return `${start}${isLast ? "" : " → …"}${stops}`;
  if (end) return `… → ${end}${stops}`;
  return stops ? `${day.stops.length} จุดแวะ` : "ยังไม่มีจุด";
}

function MultiDayReviewTimeline({ draft }: { draft: BookingDraft }) {
  const { t } = useCustomerPrefs();
  const [open, setOpen] = useState(false);
  const days =
    draft.days.length === draft.numberOfDays && draft.startDate
      ? draft.days
      : buildDaysFromDuration(draft.startDate, draft.numberOfDays, draft.days);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {formatThaiDateRange(draft.startDate, draft.numberOfDays)}
        <span className="font-normal text-muted"> · {t("booking.daysCount", { n: draft.numberOfDays })}</span>
      </p>
      <ul className="space-y-2">
        {days.map((day, index) => (
          <li key={day.dayNumber} className="text-sm">
            <span className="text-muted">{t("booking.dayN", { n: day.dayNumber })}</span>
            <span className="mx-1.5 text-[color:var(--store-line,#E8E2D8)]">·</span>
            <span>{formatThaiShortDate(day.date)}</span>
            <p className="mt-0.5 text-xs text-muted">
              {dayLineSummary(day, index > 0 ? days[index - 1] : null, index === days.length - 1)}
            </p>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
      >
        {open ? t("common.close") : t("myBookings.open")}
      </button>
      {open ? (
        <div className="space-y-3 rounded-2xl bg-[color:var(--store-paper,#F7F4EF)] px-3 py-3">
          {days.map((day, index) => {
            const start = resolveDayStart(day, index > 0 ? days[index - 1] : null);
            const isLast = index === days.length - 1;
            return (
              <div key={day.dayNumber} className="text-xs leading-5">
                <p className="font-semibold">
                  วันที่ {day.dayNumber} · {formatThaiShortDate(day.date)}
                </p>
                {day.undecided ? (
                  <p className="text-muted">ยังไม่ได้วางแผน</p>
                ) : (
                  <>
                    <p>เริ่ม: {start?.label || "—"}{day.startTime ? ` · ${day.startTime}` : ""}</p>
                    {day.stops.map((s) => (
                      <p key={`${day.dayNumber}-${s.label}`}>แวะ: {s.label}</p>
                    ))}
                    <p>
                      {isLast ? "ส่งสุดท้าย" : "จบวัน"}: {day.endLocation?.label || "—"}
                      {day.endTime ? ` · ${day.endTime}` : ""}
                    </p>
                    {day.notes ? <p className="text-muted">{day.notes}</p> : null}
                  </>
                )}
              </div>
            );
          })}
          {draft.letStorePlanTrip ? (
            <p className="text-xs text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]">{t("booking.storeHelpsTrip")}</p>
          ) : null}
          {draft.storeHelpInterests.length ? (
            <p className="text-xs text-muted">สนใจ: {draft.storeHelpInterests.join(" · ")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StepReview({
  draft,
  scenicUrl,
  selectedVehicle,
  places,
  multi,
  onEdit,
  issues,
}: {
  draft: BookingDraft;
  scenicUrl: string;
  selectedVehicle?: Vehicle;
  places: Place[];
  multi: boolean;
  onEdit: (step: BookingWizardStep) => void;
  issues: BookingFieldIssue[];
}) {
  const { t } = useCustomerPrefs();
  const serviceOpt = SERVICE_OPTION_KEYS.find((s) => s.type === draft.serviceType);
  const serviceLabel = serviceOpt ? t(serviceOpt.labelKey) : draft.serviceType;
  const stopPlaces = draft.placeIds
    .map((id) => places.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .map((name) => displayVehicleName(String(name)));
  const warnings = reviewSectionWarnings(draft);
  const issueCount = issues.length || Object.values(warnings).filter(Boolean).length;
  const noteText = draft.notes.trim();
  const scenic = scenicUrl;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[1.45rem] font-semibold tracking-tight md:text-2xl">
          {t("booking.reviewTitle")}
        </h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          {t("booking.reviewHint")}
        </p>
        {issueCount ? (
          <p className="mt-2 text-sm font-medium text-danger">{t("booking.fixFix", { count: issueCount })}</p>
        ) : null}
      </div>

      <ReviewBlock title={t("booking.review.service")} warning={warnings.trip} onEdit={() => onEdit(1)}>
        <p className="font-medium">{serviceLabel}</p>
      </ReviewBlock>

      <ReviewBlock title={t("booking.review.datetime")} onEdit={() => onEdit(2)}>
        {multi ? (
          <p className="text-sm">
            {formatThaiDateRange(draft.startDate, draft.numberOfDays)}
            <span className="text-muted"> · {t("booking.daysCount", { n: draft.numberOfDays })}</span>
          </p>
        ) : (
          <p className="text-sm">
            {draft.startDate}
            {draft.startTime ? ` · ${draft.startTime}` : ""}
            {draft.multiDay && draft.endDate
              ? ` → ${draft.endDate}${draft.endTime ? ` · ${draft.endTime}` : ""}`
              : ""}
          </p>
        )}
      </ReviewBlock>

      <ReviewBlock title={t("booking.review.route")} warning={warnings.trip} onEdit={() => onEdit(2)}>
        {scenic ? (
          <div className="mb-3 overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={scenic} alt="" className="h-28 w-full object-cover" loading="lazy" />
          </div>
        ) : null}
        {multi ? (
          <MultiDayReviewTimeline draft={draft} />
        ) : (
          <ul className="mt-1 space-y-1.5 text-sm">
            <li>{t("booking.pickupLine", { place: customerLocationTitle(draft.pickup) || "—" })}</li>
            {customerLocationAddress(draft.pickup) ? (
              <li className="pl-5 text-xs text-muted">{customerLocationAddress(draft.pickup)}</li>
            ) : null}
            <li>{t("booking.dropoffLine", { place: customerLocationTitle(draft.dropoff) || "—" })}</li>
            {customerLocationAddress(draft.dropoff) ? (
              <li className="pl-5 text-xs text-muted">{customerLocationAddress(draft.dropoff)}</li>
            ) : null}
            <li>
              {t("booking.passengersLuggage", { passengers: draft.passengers, luggage: draft.luggage })}
            </li>
          </ul>
        )}
      </ReviewBlock>

      <ReviewBlock title={t("booking.vehicle")} warning={warnings.vehicle} onEdit={() => onEdit(3)}>
        {draft.letStoreChooseVehicle ? (
          <p>{t("booking.letStoreRecommend")}</p>
        ) : selectedVehicle ? (
          <div className="flex gap-3">
            {selectedVehicle.imageUrls[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedVehicle.imageUrls[0]}
                alt=""
                className="h-20 w-28 rounded-xl object-cover"
                loading="lazy"
              />
            ) : null}
            <div>
              <p className="font-medium">
                {displayVehicleName(`${selectedVehicle.brand} ${selectedVehicle.model}`)}
              </p>
              <p className="text-xs text-muted">
                {t("booking.seatsLuggage", { seats: selectedVehicle.seats, luggage: selectedVehicle.luggageCapacity })}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-danger">{t("booking.noVehicleSelected")}</p>
        )}
      </ReviewBlock>

      {!multi && (stopPlaces.length || draft.letStorePlanTrip) ? (
        <ReviewBlock title={t("booking.review.stops")} onEdit={() => onEdit(2)}>
          {draft.letStorePlanTrip ? <p>{t("booking.storeHelpsTrip")}</p> : null}
          {stopPlaces.map((name) => (
            <p key={name}>{name}</p>
          ))}
        </ReviewBlock>
      ) : null}

      <ReviewBlock title={t("booking.customerInfo")} warning={warnings.customer} onEdit={() => onEdit(4)}>
        <p>{draft.name}</p>
        <p>{draft.phone}</p>
        {draft.email.trim() ? <p>{draft.email}</p> : null}
        {noteText && noteText !== "มี" ? <p className="text-muted">{noteText}</p> : null}
      </ReviewBlock>

      <div className="booking-trust-banner">
        <p className="text-sm font-semibold">
          {t("booking.quotePending")}
        </p>
        <p className="mt-1 text-xs text-white/75">{t("booking.notConfirmed")}</p>
      </div>
    </section>
  );
}

function ReviewBlock({
  title,
  onEdit,
  warning,
  children,
}: {
  title: string;
  onEdit: () => void;
  warning?: string;
  children: React.ReactNode;
}) {
  const { t } = useCustomerPrefs();
  return (
    <div className="booking-review-card">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium tracking-wide text-muted">{title}</p>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 text-xs font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
        >
          {t("booking.edit")}
        </button>
      </div>
      {warning ? <p className="mb-2 text-xs font-medium text-danger">⚠ {warning}</p> : null}
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}

function OptionalTripAction({
  count,
  letStorePlan,
  onOpen,
}: {
  count: number;
  letStorePlan: boolean;
  onOpen: () => void;
}) {
  const { t } = useCustomerPrefs();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-dashed border-[color:var(--store-primary,#0F3D3E)]/25 bg-white/70 px-4 py-3 text-left"
    >
      <p className="text-sm font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]">
        {t("booking.addStopPlan")}
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {t("booking.optional")}
        {count || letStorePlan
          ? ` · ${letStorePlan ? t("booking.storeHelpsPlan") : ""}${count ? t("booking.stopsCount", { count }) : ""}`
          : ""}
      </p>
    </button>
  );
}

function Stepper({
  label,
  icon,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  icon?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const { t } = useCustomerPrefs();
  return (
    <div className="booking-stepper-card">
      <p className="mb-2 text-[11px] font-medium tracking-wide text-muted">
        {icon ? `${icon} ` : ""}
        {label}
      </p>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={t("booking.decrease", { label })}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--store-paper,#F7F4EF)] text-lg"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className="min-w-[1.5rem] text-center text-base font-semibold">{value}</span>
        <button
          type="button"
          aria-label={t("booking.increase", { label })}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--store-paper,#F7F4EF)] text-lg"
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SummaryBits({
  draft,
  vehicle,
  multi,
}: {
  draft: BookingDraft;
  vehicle?: Vehicle;
  multi: boolean;
}) {
  const { t } = useCustomerPrefs();
  const pickupLabel = multi
    ? draft.days[0]?.startLocation?.label || draft.pickup?.label
    : draft.pickup?.label;

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-muted">{t("booking.dayLabel")}</dt>
        <dd className="max-w-[10rem] text-right font-medium">
          {multi && draft.startDate
            ? formatThaiDateRange(draft.startDate, draft.numberOfDays)
            : draft.startDate || "—"}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted">{t("booking.receive")}</dt>
        <dd className="max-w-[9rem] truncate text-right font-medium">{pickupLabel || "—"}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted">{t("booking.vehicle")}</dt>
        <dd className="max-w-[9rem] truncate text-right font-medium">
          {draft.letStoreChooseVehicle
            ? t("booking.storePicks")
            : vehicle
              ? displayVehicleName(`${vehicle.brand} ${vehicle.model}`)
              : "—"}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted">{t("booking.passengers")}</dt>
        <dd className="font-medium">{draft.passengers}</dd>
      </div>
    </dl>
  );
}

function FaqSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useCustomerPrefs();
  const [openId, setOpenId] = useState<number | null>(0);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label={t("common.close")} />
      <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-[color:var(--store-paper,#F7F4EF)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-full md:max-w-md md:rounded-none">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("booking.faq")}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            {t("common.close")}
          </button>
        </div>
        <ul className="space-y-2">
          {FAQ_KEYS.map((item, index) => {
            const expanded = openId === index;
            return (
              <li key={item.q} className="rounded-2xl bg-white">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
                  onClick={() => setOpenId(expanded ? null : index)}
                >
                  {t(item.q)}
                  <span className="text-muted">{expanded ? "−" : "+"}</span>
                </button>
                {expanded ? <p className="px-4 pb-3 text-sm leading-6 text-muted">{t(item.a)}</p> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ContactSheet({
  open,
  onClose,
  brand,
}: {
  open: boolean;
  onClose: () => void;
  brand: ReturnType<typeof resolveCustomerStorefrontBranding>;
}) {
  const { t } = useCustomerPrefs();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label={t("common.close")} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-[color:var(--store-paper,#F7F4EF)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-y-0 md:left-auto md:right-0 md:w-full md:max-w-md md:rounded-none">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("common.contactStore")}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            {t("common.close")}
          </button>
        </div>
        <ContactStoreLinks brand={brand} />
      </div>
    </div>
  );
}
