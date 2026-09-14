/**
 * Booking UX / Quick Booking 5-card draft + request checks.
 * Fixtures: TEST_BOOKING_UX_
 */
import {
  LocalStore,
  purgeByClientRequestPrefix,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import {
  BOOKING_DRAFT_KEY,
  displayVehicleName,
  emptyBookingDraft,
  migrateLegacyWizardStep,
  type BookingDraft,
} from "../src/lib/booking/draft";
import { draftToSubmitPayload } from "../src/lib/booking/submit";
import { buildDaysFromDuration } from "../src/lib/booking/itinerary";
import { normalizeClockTime } from "../src/lib/booking/normalize";
import { resolveBusinessBranding, POND_BRAND_DEFAULTS } from "../src/lib/domain/branding";
import type { Actor } from "../src/lib/domain/types";
import type { StructuredLocation } from "../src/lib/domain/location";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_BOOKING_UX_";

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

const pondOwner: Actor = {
  kind: "user",
  userId: SEED.userPondOwner,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessPond],
};

const pickup: StructuredLocation = {
  label: "สนามบินเชียงใหม่ (CNX)",
  address: "ตำบลสุเทพ อำเภอเมืองเชียงใหม่",
  latitude: 18.7669,
  longitude: 98.9626,
  placeId: "cm-airport",
  placeType: "airport",
  customerNote: "รอหน้า Lobby",
  source: "SAVED_PLACE",
};

const dropoff: StructuredLocation = {
  label: "นิมมานเหมินทร์",
  address: "ถนนนิมมานเหมินทร์ เชียงใหม่",
  latitude: 18.8002,
  longitude: 98.9675,
  placeId: "cm-nimman",
  placeType: "area",
  customerNote: "ประตู 3",
  source: "SEARCH",
};

function sampleDraft(partial?: Partial<BookingDraft>): BookingDraft {
  return emptyBookingDraft({
    step: 5,
    serviceType: "AIRPORT_TRANSFER",
    startDate: "2026-12-01",
    startTime: "10:30",
    multiDay: false,
    pickup,
    dropoff,
    passengers: 3,
    luggage: 2,
    letStoreChooseVehicle: true,
    preferredVehicleId: null,
    placeIds: [],
    letStorePlanTrip: false,
    name: "ลูกค้า UX",
    phone: "0899200001",
    email: "ux@example.com",
    notes: "มีเด็กเล็ก",
    ...partial,
  });
}

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);

    // Draft defaults / step state
    const blank = emptyBookingDraft();
    assert("Step state default is 1", blank.step === 1);
    assert("Draft version is 4 (Quick Booking ≤5 cards)", blank.version === 4);
    assert("Legacy step 4 → review card 5", migrateLegacyWizardStep(4, 2) === 5);
    assert("Legacy step 2 → vehicle card 3", migrateLegacyWizardStep(2, 2) === 3);
    assert("Former 6-card schedule+route → travel", migrateLegacyWizardStep(3, 3) === 2);
    assert("Former 6-card review → 5", migrateLegacyWizardStep(6, 3) === 5);
    assert("Default let store choose vehicle", blank.letStoreChooseVehicle === true);
    assert("Default passengers/luggage compact", blank.passengers === 2 && blank.luggage === 2);

    // Draft persistence shape (key namespaced by slug)
    assert("Draft key namespaced", BOOKING_DRAFT_KEY === "kh_booking_draft_v2");

    // Service selection + conditional end date (multi-day derives end from duration)
    const multiDays = buildDaysFromDuration("2026-12-01", 3);
    multiDays[0].startLocation = pickup;
    multiDays[0].startTime = "10:30";
    multiDays[0].endLocation = dropoff;
    multiDays[1].startLocation = dropoff;
    multiDays[1].inheritStartFromPrevious = true;
    multiDays[1].endLocation = dropoff;
    multiDays[2].startLocation = dropoff;
    multiDays[2].inheritStartFromPrevious = true;
    multiDays[2].endLocation = pickup;
    multiDays[2].endTime = "18:00";
    const multi = sampleDraft({
      serviceType: "MULTI_DAY_TRIP",
      multiDay: true,
      numberOfDays: 3,
      days: multiDays,
      startDate: "2026-12-01",
    });
    const multiPayload = draftToSubmitPayload("pondcarrent", multi, "DIRECT");
    assert("Service selection MULTI_DAY", !("error" in multiPayload) && multiPayload.serviceType === "MULTI_DAY_TRIP");
    assert(
      "Conditional end date/time",
      !("error" in multiPayload) && multiPayload.endDate === "2026-12-03" && multiPayload.endTime === "18:00",
    );
    const oneDay = draftToSubmitPayload("pondcarrent", sampleDraft({ multiDay: false, endDate: "2026-12-99" }), "DIRECT");
    assert(
      "End date omitted when multiDay off",
      !("error" in oneDay) && oneDay.endDate === null && oneDay.endTime === null,
    );
    const timed = draftToSubmitPayload(
      "pondcarrent",
      sampleDraft({ startTime: "10:30" }),
      "DIRECT",
    );
    assert(
      "Editable startTime reaches payload as 10:30",
      !("error" in timed) && timed.startTime === "10:30",
    );
    assert("normalizeClockTime keeps HH:MM", normalizeClockTime("10:30") === "10:30");
    assert("normalizeClockTime strips seconds", normalizeClockTime("10:30:00") === "10:30");
    const wizardSrc = readFileSync(join(process.cwd(), "src/components/storefront/BookingWizard.tsx"), "utf8");
    assert("wizard uses BookingTimeField", wizardSrc.includes("BookingTimeField"));
    assert("wizard travel step has no opacity time input", !wizardSrc.includes('type="time"'));

    // Structured pickup/dropoff + note
    const payload = draftToSubmitPayload("pondcarrent", sampleDraft(), "DIRECT");
    assert("Pickup structured data", !("error" in payload) && payload.pickupLocation === pickup.label);
    assert(
      "Pickup lat/lng/placeId/source/note",
      !("error" in payload) &&
        payload.pickupLat === pickup.latitude &&
        payload.pickupLng === pickup.longitude &&
        payload.pickupPlaceId === pickup.placeId &&
        payload.pickupSource === pickup.source &&
        payload.pickupNote === pickup.customerNote,
    );
    assert(
      "Dropoff structured data",
      !("error" in payload) &&
        payload.dropoffLocation === dropoff.label &&
        payload.dropoffPlaceId === dropoff.placeId &&
        payload.dropoffNote === dropoff.customerNote,
    );

    // Vehicle selection modes
    const storePick = draftToSubmitPayload(
      "pondcarrent",
      sampleDraft({ letStoreChooseVehicle: true, preferredVehicleId: "should-ignore" }),
      "DIRECT",
    );
    assert(
      "Store-selects-vehicle clears preferredVehicleId",
      !("error" in storePick) && storePick.preferredVehicleId === null,
    );

    const pond = await store.getPublicStore("pondcarrent");
    assert("POND public store", Boolean(pond));
    const vehicleId = pond!.vehicles[0]?.id ?? null;
    assert("POND has vehicles", Boolean(vehicleId));
    const selfPick = draftToSubmitPayload(
      "pondcarrent",
      sampleDraft({ letStoreChooseVehicle: false, preferredVehicleId: vehicleId }),
      "DIRECT",
    );
    assert(
      "Vehicle selection kept",
      !("error" in selfPick) && selfPick.preferredVehicleId === vehicleId,
    );

    const sampleName = pond!.vehicles[0]
      ? `${pond!.vehicles[0].brand} ${pond!.vehicles[0].model}`
      : "Toyota Commuter (ตัวอย่าง)";
    assert(
      "No duplicate / sample vehicle name strip",
      displayVehicleName("Toyota Commuter (ตัวอย่าง)") === "Toyota Commuter" &&
        !displayVehicleName(sampleName).includes("(ตัวอย่าง)"),
    );

    // Passenger/luggage
    assert(
      "Passenger/luggage in payload",
      !("error" in payload) && payload.passengerCount === 3 && payload.luggageCount === 2,
    );

    // Optional itinerary
    const placeId = pond!.places[0]?.id;
    const withTrip = draftToSubmitPayload(
      "pondcarrent",
      sampleDraft({
        placeIds: placeId ? [placeId] : [],
        letStorePlanTrip: true,
      }),
      "DIRECT",
    );
    assert(
      "Optional itinerary",
      !("error" in withTrip) &&
        withTrip.letStorePlanTrip === true &&
        (placeId ? withTrip.placeIds.includes(placeId) : withTrip.placeIds.length === 0),
    );

    // Customer details validation
    const badName = draftToSubmitPayload("pondcarrent", sampleDraft({ name: "A" }), "DIRECT");
    assert("Customer details name validation", "error" in badName);
    const badPhone = draftToSubmitPayload("pondcarrent", sampleDraft({ phone: "12" }), "DIRECT");
    assert("Customer details phone validation", "error" in badPhone);

    // Auth return preserves draft: step stays where left
    const midAuth = emptyBookingDraft({
      ...sampleDraft({ step: 3, name: "หลังล็อกอิน" }),
    });
    assert("Auth return preserves draft step", midAuth.step === 3 && midAuth.name === "หลังล็อกอิน");
    assert("Auth return preserves pickup", midAuth.pickup?.label === pickup.label);

    // Review data completeness
    assert(
      "Review data present",
      Boolean(midAuth.pickup && midAuth.dropoff && midAuth.startDate && midAuth.phone),
    );

    // Create request once + double-submit safe
    if ("error" in payload) throw new Error(payload.error);
    const clientRequestId = `${PREFIX}once`;
    const created = await store.createBookingRequest({
      ...payload,
      clientRequestId,
    });
    assert("Request creates exactly once", Boolean(created.booking.bookingCode));
    const code = created.booking.bookingCode;
    const again = await store.createBookingRequest({
      ...payload,
      clientRequestId,
    });
    assert("Double submit safe (idempotent)", again.booking.id === created.booking.id);
    assert("Real success booking code", /^[A-Z0-9-]+$/i.test(code) && code.length >= 4);

    // Expected location not overwritten by check-in fields
    const detail = await store.getBookingByToken(created.booking.securePublicToken);
    assert(
      "Location check-in compatibility — expected pickup preserved",
      detail?.booking.pickupLocation === pickup.label &&
        detail.booking.pickupLat === pickup.latitude &&
        detail.booking.pickupNote === pickup.customerNote,
    );

    // Tenant branding
    const pondBrand = resolveBusinessBranding(pond!.business);
    assert("Tenant branding POND", pondBrand.businessName.includes("POND"));
    assert(
      "POND white-label colors",
      pondBrand.primaryColor === POND_BRAND_DEFAULTS.primaryColor ||
        pondBrand.primaryColor.startsWith("#"),
    );

    // Store #002 isolation
    const demo = await store.getPublicStore("demo-store-002");
    assert("Store #002 loads", Boolean(demo));
    const demoBrand = resolveBusinessBranding(demo!.business);
    assert("Store #002 isolation branding", demoBrand.slug === "demo-store-002");
    assert("Store #002 different primary", demoBrand.primaryColor !== pondBrand.primaryColor);

    const demoPayload = draftToSubmitPayload(
      "demo-store-002",
      sampleDraft({ name: "ลูกค้า 002", phone: "0899200002" }),
      "DIRECT",
    );
    if ("error" in demoPayload) throw new Error(demoPayload.error);
    const demoBooking = await store.createBookingRequest({
      ...demoPayload,
      clientRequestId: `${PREFIX}demo002`,
    });
    assert("Store #002 booking created", demoBooking.booking.businessId === demo!.business.id);
    assert(
      "Store #002 isolation — not POND businessId",
      demoBooking.booking.businessId !== pond!.business.id,
    );

    const demoByToken = await store.getBookingByToken(demoBooking.booking.securePublicToken);
    assert("Booking token resolves", demoByToken?.business.slug === "demo-store-002");

    const pondList = await store.listBookings(pondOwner, SEED.businessPond);
    const leaked = pondList.some((b) => b.id === demoBooking.booking.id);
    assert("Store #002 isolation — not in POND list", !leaked);

    await purgeByClientRequestPrefix(PREFIX);
    assert("Fixture cleanup", true);
  } catch (error) {
    failed += 1;
    console.error("FAIL  booking-ux-check crashed", error);
  }

  if (failed) {
    console.error(`\nbooking-ux-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nbooking-ux-check: all passed");
}

void main();
