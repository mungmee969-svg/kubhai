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
    // Pilot: guest booking — no customer account login required
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
    // The durable public booking route is /booking/[token]. There is no
    // /success child route; pushing there caused a valid Supabase token to hit
    // the segment not-found boundary and look expired.
    router.push(`/booking/${encodeURIComponent(result.token)}`);
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
              className="mt-3 text-xs font-semibold underline underline-offset-4"
            >
              {t("booking.needHelp")}
            </button>
          </>
        }
      >
        <BookingStepContent
          draft={draft}
          update={update}
          business={business}
          settings={settings}
          vehicles={vehicles}
          places={places}
          tripPackages={tripPackages}
          selectedVehicle={selectedVehicle}
          selectedPackage={selectedPackage}
          multi={multi}
          ready={ready}
          error={error}
          issues={issues}
          onGo={go}
          onPickup={() => setPickupOpen(true)}
          onDropoff={() => setDropoffOpen(true)}
          onPlanner={() => setPlannerOpen(true)}
        />
      </BookingWizardChrome>

      <LocationPickerSheet
        open={pickupOpen}
        onClose={() => setPickupOpen(false)}
        title={t("booking.pickup")}
        value={draft.pickup}
        onConfirm={(location) => {
          update({ pickup: location });
          setPickupOpen(false);
        }}
      />
      <LocationPickerSheet
        open={dropoffOpen}
        onClose={() => setDropoffOpen(false)}
        title={t("booking.dropoff")}
        value={draft.dropoff}
        onConfirm={(location) => {
          update({ dropoff: location });
          setDropoffOpen(false);
        }}
      />
      <TripPlannerSheet
        open={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        startDate={draft.startDate}
        numberOfDays={draft.numberOfDays}
        days={draft.days}
        places={places}
        onChange={(days) => update({ days })}
      />
      <FaqSheet open={faqOpen} onClose={() => setFaqOpen(false)} />
      <ContactSheet
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        business={business}
      />
    </div>
  );
}

function BookingStepContent({
  draft,
  update,
  business,
  settings,
  vehicles,
  places,
  tripPackages,
  selectedVehicle,
  selectedPackage,
  multi,
  ready,
  error,
  issues,
  onGo,
  onPickup,
  onDropoff,
  onPlanner,
}: {
  draft: BookingDraft;
  update: (partial: Partial<BookingDraft>) => void;
  business: Business;
  settings: BusinessSettings | null;
  vehicles: Vehicle[];
  places: Place[];
  tripPackages: TripPackage[];
  selectedVehicle?: Vehicle;
  selectedPackage?: TripPackage;
  multi: boolean;
  ready: boolean;
  error: string | null;
  issues: BookingFieldIssue[];
  onGo: (step: BookingWizardStep) => void;
  onPickup: () => void;
  onDropoff: () => void;
  onPlanner: () => void;
}) {
  const { t } = useCustomerPrefs();

  if (!ready) {
    return <p className="py-10 text-center text-sm text-muted">{t("common.loading")}</p>;
  }

  if (draft.step === 1) {
    return (
      <section className="space-y-4">
        <StepHeading title={t("booking.step1.title")} subtitle={t("booking.step1.subtitle")} />
        <div className="grid gap-3 sm:grid-cols-2">
          {SERVICE_OPTION_KEYS.map((item) => {
            const active = draft.serviceType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() =>
                  update({
                    serviceType: item.type,
                    multiDay: isMultiDayService(item.type),
                  })
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-[color:var(--store-primary,#0F3D3E)] bg-[color:var(--store-secondary,#E8F0EF)]"
                    : "border-black/10 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ServiceTypeIcon serviceType={item.type} className="h-9 w-9" />
                  <div>
                    <p className="font-semibold">{t(item.labelKey)}</p>
                    <p className="mt-1 text-xs text-muted">{t(item.hintKey)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (draft.step === 2) {
    return (
      <section className="space-y-4">
        <StepHeading title={t("booking.step2.title")} subtitle={t("booking.step2.subtitle")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            <span>{t("booking.date")}</span>
            <input
              type="date"
              value={draft.startDate}
              onChange={(event) => update({ startDate: event.target.value })}
              className="h-12 w-full rounded-xl border border-black/10 bg-white px-3"
            />
          </label>
          <BookingTimeField
            value={draft.startTime}
            onChange={(startTime) => update({ startTime })}
            label={t("booking.time")}
          />
        </div>

        {multi ? (
          <MultiDayOverview
            startDate={draft.startDate}
            numberOfDays={draft.numberOfDays}
            days={draft.days}
            onChangeDays={(numberOfDays) =>
              update({
                numberOfDays,
                days: buildDaysFromDuration(draft.startDate, numberOfDays, draft.days),
              })
            }
            onOpenPlanner={onPlanner}
          />
        ) : (
          <div className="space-y-3">
            <CompactLocationField
              label={t("booking.pickup")}
              value={draft.pickup}
              onClick={onPickup}
            />
            <CompactLocationField
              label={t("booking.dropoff")}
              value={draft.dropoff}
              onClick={onDropoff}
            />
          </div>
        )}
      </section>
    );
  }

  if (draft.step === 3) {
    return (
      <section className="space-y-4">
        <StepHeading title={t("booking.step3.title")} subtitle={t("booking.step3.subtitle")} />
        <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-4">
          <input
            type="checkbox"
            checked={draft.letStoreChooseVehicle}
            onChange={(event) =>
              update({
                letStoreChooseVehicle: event.target.checked,
                preferredVehicleId: event.target.checked ? null : draft.preferredVehicleId,
              })
            }
          />
          <span className="text-sm font-medium">{t("booking.letStoreChooseVehicle")}</span>
        </label>
        {!draft.letStoreChooseVehicle ? (
          <VehicleGallerySheet
            open
            embedded
            vehicles={vehicles}
            selectedVehicleId={draft.preferredVehicleId}
            onSelect={(vehicleId) => update({ preferredVehicleId: vehicleId })}
            onClose={() => undefined}
          />
        ) : null}
      </section>
    );
  }

  if (draft.step === 4) {
    return (
      <section className="space-y-4">
        <StepHeading title={t("booking.step4.title")} subtitle={t("booking.step4.subtitle")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("booking.name")} value={draft.name} onChange={(name) => update({ name })} />
          <Field label={t("booking.phone")} value={draft.phone} onChange={(phone) => update({ phone })} />
          <Field label={t("booking.email")} value={draft.email} onChange={(email) => update({ email })} />
          <Field label={t("booking.company")} value={draft.companyName} onChange={(companyName) => update({ companyName })} />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <StepHeading title={t("booking.step5.title")} subtitle={t("booking.step5.subtitle")} />
      {error ? <ErrorPanel error={error} issues={issues} onGo={onGo} /> : null}
      <ReviewCard draft={draft} vehicle={selectedVehicle} packageItem={selectedPackage} multi={multi} />
    </section>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-black/10 bg-white px-3"
      />
    </label>
  );
}

function ErrorPanel({
  error,
  issues,
  onGo,
}: {
  error: string;
  issues: BookingFieldIssue[];
  onGo: (step: BookingWizardStep) => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">{error}</p>
      {issues.length ? (
        <button
          type="button"
          onClick={() => onGo(firstIssueStep(issues))}
          className="mt-2 font-semibold underline"
        >
          กลับไปแก้ข้อมูล
        </button>
      ) : null}
    </div>
  );
}

function ReviewCard({
  draft,
  vehicle,
  packageItem,
  multi,
}: {
  draft: BookingDraft;
  vehicle?: Vehicle;
  packageItem?: TripPackage;
  multi: boolean;
}) {
  const { t, locale } = useCustomerPrefs();
  const warnings = reviewSectionWarnings(draft);
  const days = draft.days.length
    ? draft.days
    : buildDaysFromDuration(draft.startDate, draft.numberOfDays, draft.days);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <p className="font-semibold">{t("booking.summary")}</p>
        <div className="mt-3 space-y-2 text-sm">
          <ReviewRow label={t("booking.service")} value={draft.serviceType ? t(SERVICE_OPTION_KEYS.find((x) => x.type === draft.serviceType)?.labelKey ?? "") : "-"} />
          <ReviewRow label={t("booking.date")} value={multi ? formatThaiDateRange(draft.startDate, derivedEndDate(draft.startDate, draft.numberOfDays)) : formatThaiShortDate(draft.startDate)} />
          <ReviewRow label={t("booking.time")} value={draft.startTime || "-"} />
          <ReviewRow label={t("booking.pickup")} value={multi ? days[0]?.startLocation?.label ?? "-" : customerLocationTitle(draft.pickup) || "-"} />
          <ReviewRow label={t("booking.dropoff")} value={multi ? days[days.length - 1]?.endLocation?.label ?? "-" : customerLocationTitle(draft.dropoff) || "-"} />
          <ReviewRow label={t("booking.vehicle")} value={draft.letStoreChooseVehicle ? t("booking.storeChoose") : displayVehicleName(vehicle)} />
          <ReviewRow label={t("booking.passengers")} value={String(draft.passengers)} />
          <ReviewRow label={t("booking.luggage")} value={String(draft.luggage)} />
          <ReviewRow label={t("booking.name")} value={draft.name || "-"} />
          <ReviewRow label={t("booking.phone")} value={draft.phone || "-"} />
          {draft.email ? <ReviewRow label={t("booking.email")} value={draft.email} /> : null}
          {packageItem ? <ReviewRow label={t("booking.package")} value={localizedPackageText(locale, packageItem.title, "แพ็กเกจทริป")} /> : null}
        </div>
      </div>
      {warnings.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {warnings.map((warning) => <p key={warning}>• {warning}</p>)}
        </div>
      ) : null}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-2 last:border-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SummaryBits({ draft, vehicle, multi }: { draft: BookingDraft; vehicle?: Vehicle; multi: boolean }) {
  const { t } = useCustomerPrefs();
  return (
    <div className="mt-3 space-y-2 text-xs">
      <p>{draft.startDate ? formatThaiShortDate(draft.startDate) : t("booking.noDate")}</p>
      <p>{multi ? `${draft.numberOfDays} ${t("booking.days")}` : `${customerLocationTitle(draft.pickup) || "-"} → ${customerLocationTitle(draft.dropoff) || "-"}`}</p>
      <p>{draft.letStoreChooseVehicle ? t("booking.storeChoose") : displayVehicleName(vehicle)}</p>
    </div>
  );
}

function FaqSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useCustomerPrefs();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 p-4" onClick={onClose}>
      <div className="mx-auto mt-12 max-w-xl rounded-3xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-semibold">{t("booking.faq.title")}</p>
          <button type="button" onClick={onClose} className="text-sm font-semibold">{t("common.close")}</button>
        </div>
        <div className="mt-4 space-y-3">
          {FAQ_KEYS.map((item) => (
            <details key={item.q} className="rounded-xl border border-black/10 p-3">
              <summary className="cursor-pointer text-sm font-semibold">{t(item.q)}</summary>
              <p className="mt-2 text-xs leading-5 text-muted">{t(item.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactSheet({ open, onClose, business }: { open: boolean; onClose: () => void; business: Business }) {
  const { t } = useCustomerPrefs();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 p-4" onClick={onClose}>
      <div className="mx-auto mt-20 max-w-lg rounded-3xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-semibold">{t("booking.needHelp")}</p>
          <button type="button" onClick={onClose} className="text-sm font-semibold">{t("common.close")}</button>
        </div>
        <div className="mt-4">
          <ContactStoreLinks business={business} />
        </div>
      </div>
    </div>
  );
}

function PrimaryCta({
  label,
  pending,
  tone,
  onClick,
  className = "",
}: {
  label: string;
  pending: boolean;
  tone: "primary" | "gold";
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`${className} flex h-[3.15rem] items-center justify-center rounded-2xl px-5 text-sm font-semibold shadow-sm disabled:opacity-60 ${
        tone === "gold"
          ? "bg-[color:var(--store-accent,#C4A35A)] text-white"
          : "bg-[color:var(--store-primary,#0F3D3E)] text-white"
      }`}
    >
      {pending ? "..." : label}
    </button>
  );
}
