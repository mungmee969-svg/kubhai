import type { BookingSource, ServiceType } from "@/lib/domain/enums";
import type { StructuredLocation } from "@/lib/domain/location";
import {
  buildDaysFromDuration,
  daysToItineraryItems,
  type DayPlan,
  type StoreHelpInterest,
} from "@/lib/booking/itinerary";

/** Quick Booking: max 5 customer-facing cards (≤6). */
export type BookingWizardStep = 1 | 2 | 3 | 4 | 5;

export const BOOKING_WIZARD_MAX_STEP = 5 as const;

export type BookingDraft = {
  /** v4 = Quick Booking 5-card flow (travel details combined). */
  version: 4;
  step: BookingWizardStep;
  serviceType: ServiceType;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  /** Simple services may still use return toggle */
  multiDay: boolean;
  /** Multi-day trip duration (inclusive calendar days) */
  numberOfDays: number;
  days: DayPlan[];
  storeHelpInterests: StoreHelpInterest[];
  pickup: StructuredLocation | null;
  dropoff: StructuredLocation | null;
  passengers: number;
  luggage: number;
  preferredVehicleId: string | null;
  letStoreChooseVehicle: boolean;
  /** Legacy flat place ids — migrated into days when possible */
  placeIds: string[];
  letStorePlanTrip: boolean;
  name: string;
  phone: string;
  email: string;
  notes: string;
  customerType: "PERSONAL" | "COMPANY";
  companyName: string;
  taxId: string;
};

export const BOOKING_DRAFT_KEY = "kh_booking_draft_v2";
const LEGACY_DRAFT_KEY = "kh_booking_draft_v1";

export function normalizeWizardStep(raw: unknown): BookingWizardStep {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n >= 1 && n <= 5) return n as BookingWizardStep;
  if (n === 6) return 5; // former review step
  return 1;
}

/**
 * Map older drafts onto Quick Booking steps:
 * 1 service · 2 travel details · 3 passengers/vehicle · 4 customer · 5 review
 */
export function migrateLegacyWizardStep(step: number, draftVersion: number): BookingWizardStep {
  if (draftVersion >= 4) return normalizeWizardStep(step);

  if (draftVersion >= 3) {
    // former 6-card: 1 service, 2 schedule, 3 route, 4 vehicle, 5 customer, 6 review
    if (step <= 1) return 1;
    if (step === 2 || step === 3) return 2;
    if (step === 4) return 3;
    if (step === 5) return 4;
    if (step >= 6) return 5;
    return normalizeWizardStep(step);
  }

  // legacy ≤2 used 4 steps: 1 trip, 2 vehicle, 3 customer, 4 review
  if (step === 1) return 1;
  if (step === 2) return 3;
  if (step === 3) return 4;
  if (step === 4) return 5;
  return normalizeWizardStep(step);
}

export function isMultiDayService(serviceType: ServiceType) {
  return serviceType === "MULTI_DAY_TRIP" || serviceType === "CUSTOM_TRIP";
}

export function emptyBookingDraft(partial?: Partial<BookingDraft>): BookingDraft {
  const base: BookingDraft = {
    version: 4,
    step: 1,
    serviceType: "PRIVATE_DRIVER_DAILY",
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "",
    multiDay: false,
    numberOfDays: 3,
    days: [],
    storeHelpInterests: [],
    pickup: null,
    dropoff: null,
    passengers: 2,
    luggage: 2,
    preferredVehicleId: null,
    letStoreChooseVehicle: true,
    placeIds: [],
    letStorePlanTrip: false,
    name: "",
    phone: "",
    email: "",
    notes: "",
    customerType: "PERSONAL",
    companyName: "",
    taxId: "",
  };
  const incomingVersion =
    typeof (partial as { version?: number } | undefined)?.version === "number"
      ? (partial as { version: number }).version
      : 4;
  const merged = { ...base, ...partial, version: 4 as const };
  merged.step = migrateLegacyWizardStep(
    typeof partial?.step === "number" ? partial.step : merged.step,
    incomingVersion,
  );
  if (isMultiDayService(merged.serviceType) && merged.startDate && !merged.days.length) {
    merged.days = buildDaysFromDuration(merged.startDate, merged.numberOfDays);
  }
  return merged;
}

function migrateLegacyDraft(raw: Record<string, unknown>): BookingDraft {
  const partial = raw as Partial<BookingDraft> & { version?: number };
  const incomingVersion = typeof partial.version === "number" ? partial.version : 1;
  const draft = emptyBookingDraft({
    ...partial,
    version: 4,
    step: migrateLegacyWizardStep(
      typeof partial.step === "number" ? partial.step : 1,
      incomingVersion,
    ),
    numberOfDays:
      typeof partial.numberOfDays === "number"
        ? partial.numberOfDays
        : partial.multiDay && partial.startDate && partial.endDate
          ? Math.max(
              1,
              Math.round(
                (new Date(`${partial.endDate}T12:00:00`).getTime() -
                  new Date(`${partial.startDate}T12:00:00`).getTime()) /
                  86_400_000,
              ) + 1,
            )
          : 3,
    days: Array.isArray(partial.days) ? (partial.days as DayPlan[]) : [],
    storeHelpInterests: Array.isArray(partial.storeHelpInterests)
      ? (partial.storeHelpInterests as StoreHelpInterest[])
      : [],
  });
  if (isMultiDayService(draft.serviceType) && draft.startDate && !draft.days.length) {
    draft.days = buildDaysFromDuration(draft.startDate, draft.numberOfDays);
    if (draft.pickup && draft.days[0]) {
      draft.days[0].startLocation = draft.pickup;
      draft.days[0].startTime = draft.startTime || "09:00";
    }
    if (draft.dropoff && draft.days.length) {
      draft.days[draft.days.length - 1].endLocation = draft.dropoff;
      draft.days[draft.days.length - 1].endTime = draft.endTime || "";
    }
  }
  if (Array.isArray(draft.placeIds)) {
    draft.placeIds = draft.placeIds.filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(id),
      ),
    );
  }
  return draft;
}

export function readBookingDraft(slug: string): BookingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(`${BOOKING_DRAFT_KEY}:${slug}`) ??
      window.sessionStorage.getItem(`${LEGACY_DRAFT_KEY}:${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return migrateLegacyDraft(parsed);
  } catch {
    return null;
  }
}

export function writeBookingDraft(slug: string, draft: BookingDraft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    `${BOOKING_DRAFT_KEY}:${slug}`,
    JSON.stringify({ ...draft, version: 4 }),
  );
  window.sessionStorage.removeItem(`${LEGACY_DRAFT_KEY}:${slug}`);
}

export function clearBookingDraft(slug: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${BOOKING_DRAFT_KEY}:${slug}`);
  window.sessionStorage.removeItem(`${LEGACY_DRAFT_KEY}:${slug}`);
}

export function displayVehicleName(name: string) {
  return name.replace(/\s*\(ตัวอย่าง\)\s*/g, "").trim();
}

export function bookingSessionId() {
  if (typeof window === "undefined") return crypto.randomUUID();
  const key = "kh_session_id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

export function bookingRequestId() {
  if (typeof window === "undefined") return crypto.randomUUID();
  const key = "kh_booking_request_id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

export function placeToStructuredLocation(
  place: Pick<
    import("@/lib/domain/types").Place,
    "id" | "name" | "address" | "latitude" | "longitude" | "category" | "area"
  >,
  preferredPeriod?: string | null,
): StructuredLocation {
  const noteParts = [
    place.area ? `ย่าน ${place.area}` : null,
    preferredPeriod ? `ช่วงที่อยากไป: ${preferredPeriod}` : null,
  ].filter(Boolean);
  return {
    label: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    placeId: place.id,
    placeType: place.category,
    customerNote: noteParts.length ? noteParts.join(" · ") : null,
    source: "SAVED_PLACE",
  };
}

/**
 * Add a discovery place into the existing booking draft DayPlan (single source of truth).
 * Hotels can be attached as end-of-day when asHotelEnd is true.
 */
export function addPlaceToBookingDraft(
  storeSlug: string,
  place: Parameters<typeof placeToStructuredLocation>[0] & { category: string },
  opts: {
    dayNumber?: number;
    numberOfDays?: number;
    asHotelEnd?: boolean;
    preferredPeriod?: string | null;
  } = {},
): BookingDraft {
  const existing = readBookingDraft(storeSlug);
  let draft = existing ?? emptyBookingDraft();
  const location = placeToStructuredLocation(place, opts.preferredPeriod ?? null);

  const wantMulti =
    opts.asHotelEnd ||
    (opts.numberOfDays != null && opts.numberOfDays > 1) ||
    (opts.dayNumber != null && opts.dayNumber > 1) ||
    isMultiDayService(draft.serviceType);

  if (wantMulti) {
    draft = {
      ...draft,
      serviceType: isMultiDayService(draft.serviceType) ? draft.serviceType : "MULTI_DAY_TRIP",
      multiDay: true,
      numberOfDays: Math.max(draft.numberOfDays || 1, opts.numberOfDays ?? opts.dayNumber ?? 2, 2),
      step: draft.step === 1 ? 2 : draft.step,
    };
    if (!draft.days.length) {
      draft.days = buildDaysFromDuration(draft.startDate || "", draft.numberOfDays);
    } else if (draft.days.length < draft.numberOfDays) {
      draft.days = buildDaysFromDuration(draft.startDate || "", draft.numberOfDays, draft.days);
    }
    const dayIndex = Math.max(0, Math.min(draft.days.length - 1, (opts.dayNumber ?? 1) - 1));
    const day = { ...draft.days[dayIndex] };
    if (opts.asHotelEnd || place.category === "HOTEL") {
      day.endLocation = location;
    } else {
      const already = day.stops.some((item) => item.placeId === place.id);
      if (!already) day.stops = [...day.stops, location];
    }
    draft.days = draft.days.map((item, index) => (index === dayIndex ? day : item));
  } else {
    const ids = new Set(draft.placeIds);
    ids.add(place.id);
    draft = {
      ...draft,
      placeIds: [...ids],
      letStorePlanTrip: false,
      step: draft.step === 1 ? 2 : draft.step,
    };
  }

  writeBookingDraft(storeSlug, draft);
  return draft;
}

export type BookingSubmitPayload = {
  businessSlug: string;
  clientRequestId: string;
  serviceType: ServiceType;
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  passengerCount: number;
  luggageCount: number | null;
  pickupLocation: string;
  dropoffLocation: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  pickupPlaceId: string | null;
  dropoffPlaceId: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  pickupNote: string | null;
  dropoffNote: string | null;
  pickupSource?: string | null;
  dropoffSource?: string | null;
  tripNotes: string | null;
  letStorePlanTrip: boolean;
  preferredVehicleId: string | null;
  placeIds: string[];
  itineraryDays?: ReturnType<typeof daysToItineraryItems>;
  storeHelpInterests?: StoreHelpInterest[];
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerType: "PERSONAL" | "COMPANY";
  companyName: string | null;
  taxId: string | null;
  source: BookingSource;
  sessionId: string;
  referrer: string | null;
};
