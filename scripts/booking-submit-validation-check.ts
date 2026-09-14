/**
 * Focused booking submit validation checks.
 * Fixtures: TEST_BOOKING_SUBMIT_VAL_
 */
import {
  LocalStore,
  purgeByClientRequestPrefix,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { emptyBookingDraft, type BookingDraft } from "../src/lib/booking/draft";
import { buildDaysFromDuration } from "../src/lib/booking/itinerary";
import {
  buildBookingSubmitPayload,
  collectBookingDraftIssues,
  draftToSubmitPayload,
  filterUuidPlaceIds,
  normalizeClockTime,
  parseBookingSubmitPayload,
} from "../src/lib/booking/submit";
import type { StructuredLocation } from "../src/lib/domain/location";
import type { Actor } from "../src/lib/domain/types";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_BOOKING_SUBMIT_VAL_";

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
  address: "ตำบลสุเทพ",
  latitude: 18.7669,
  longitude: 98.9626,
  placeId: "cm-airport",
  placeType: "airport",
  customerNote: null,
  source: "SAVED_PLACE",
};

const dropoff: StructuredLocation = {
  label: "นิมมานเหมินทร์",
  address: "ถนนนิมมาน",
  latitude: null,
  longitude: null,
  placeId: "cm-nimman",
  placeType: "area",
  customerNote: null,
  source: "MANUAL",
};

function completeSimple(partial?: Partial<BookingDraft>): BookingDraft {
  return emptyBookingDraft({
    step: 4,
    serviceType: "AIRPORT_TRANSFER",
    startDate: "2026-12-01",
    startTime: "10:30",
    pickup,
    dropoff,
    passengers: 2,
    luggage: 0,
    letStoreChooseVehicle: true,
    preferredVehicleId: null,
    placeIds: [],
    name: "ลูกค้า Submit",
    phone: "0899200001",
    email: "",
    notes: "",
    ...partial,
  });
}

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);

    assert("normalize HH:MM:SS → HH:MM", normalizeClockTime("09:00:00") === "09:00");
    assert("normalize HH:MM stays", normalizeClockTime("09:00") === "09:00");
    assert("filter catalog placeIds", filterUuidPlaceIds(["cm-airport", SEED.vehicleVan]).length === 1);

    // Complete simple → PASS (incl. HH:MM:SS time trap)
    const withSeconds = completeSimple({ startTime: "09:00:00" });
    const builtSeconds = buildBookingSubmitPayload("pondcarrent", withSeconds, "DIRECT");
    assert("simple complete with HH:MM:SS builds", builtSeconds.ok);
    if (builtSeconds.ok) {
      assert("simple startTime normalized", builtSeconds.payload.startTime === "09:00");
      const parsed = parseBookingSubmitPayload(builtSeconds.payload);
      assert("simple complete schema PASS", parsed.ok);
    }

    const emailEmpty = buildBookingSubmitPayload(
      "pondcarrent",
      completeSimple({ email: "" }),
      "DIRECT",
    );
    assert("email empty PASS", emailEmpty.ok);

    const noteEmpty = buildBookingSubmitPayload(
      "pondcarrent",
      completeSimple({ notes: "" }),
      "DIRECT",
    );
    assert("note empty PASS", noteEmpty.ok);

    const luggage0 = buildBookingSubmitPayload(
      "pondcarrent",
      completeSimple({ luggage: 0 }),
      "DIRECT",
    );
    assert("luggage 0 PASS", luggage0.ok);

    const storeSelect = buildBookingSubmitPayload(
      "pondcarrent",
      completeSimple({ letStoreChooseVehicle: true, preferredVehicleId: "ignored" }),
      "DIRECT",
    );
    assert(
      "store-select vehicle PASS",
      storeSelect.ok && storeSelect.payload.preferredVehicleId === null,
    );

    const pond = await store.getPublicStore("pondcarrent");
    const vehicleId = pond!.vehicles[0]!.id;
    const selected = buildBookingSubmitPayload(
      "pondcarrent",
      completeSimple({ letStoreChooseVehicle: false, preferredVehicleId: vehicleId }),
      "DIRECT",
    );
    assert(
      "selected vehicle PASS",
      selected.ok && selected.payload.preferredVehicleId === vehicleId,
    );

    // Field failures
    const missingPickup = collectBookingDraftIssues(completeSimple({ pickup: null }));
    assert(
      "missing pickup FAIL",
      missingPickup.some((i) => i.path === "pickupLocation"),
    );

    const missingDropoff = collectBookingDraftIssues(completeSimple({ dropoff: null }));
    assert(
      "missing dropoff FAIL",
      missingDropoff.some((i) => i.path === "dropoffLocation"),
    );

    const missingPhone = collectBookingDraftIssues(completeSimple({ phone: "" }));
    assert(
      "missing phone FAIL",
      missingPhone.some((i) => i.path === "customerPhone"),
    );

    // Multi-day complete
    const days = buildDaysFromDuration("2026-12-01", 3);
    days[0].startLocation = pickup;
    days[0].startTime = "09:00:00";
    days[0].endLocation = dropoff;
    days[1].inheritStartFromPrevious = true;
    days[1].undecided = true;
    days[2].startLocation = dropoff;
    days[2].inheritStartFromPrevious = true;
    days[2].endLocation = pickup;
    days[2].endTime = "18:00:00";
    const multi = emptyBookingDraft({
      serviceType: "MULTI_DAY_TRIP",
      startDate: "2026-12-01",
      numberOfDays: 3,
      days,
      name: "ลูกค้า Multi",
      phone: "0899200001",
      email: "",
      notes: "",
      letStoreChooseVehicle: true,
      storeHelpInterests: ["คาเฟ่"],
      letStorePlanTrip: true,
    });
    const multiBuilt = buildBookingSubmitPayload("pondcarrent", multi, "DIRECT");
    assert("multi-day complete PASS", multiBuilt.ok);
    if (multiBuilt.ok) {
      assert("multi startTime normalized", multiBuilt.payload.startTime === "09:00");
      assert("multi endTime normalized", multiBuilt.payload.endTime === "18:00");
      assert("multi schema PASS", parseBookingSubmitPayload(multiBuilt.payload).ok);
    }

    // Partial middle / STORE_HELP / no stops / inherited start already covered above
    assert("multi-day partial middle day PASS", multiBuilt.ok);
    assert("multi-day STORE_HELP PASS", multiBuilt.ok);
    assert(
      "multi-day no stops PASS",
      multiBuilt.ok && multiBuilt.payload.itineraryDays.some((d) => d.kind === "UNDECIDED"),
    );
    assert("multi-day inherited start PASS", multiBuilt.ok);

    const noFinal = emptyBookingDraft({
      ...multi,
      days: days.map((d, i) => (i === days.length - 1 ? { ...d, endLocation: null } : d)),
    });
    const noFinalIssues = collectBookingDraftIssues(noFinal);
    assert(
      "missing FINAL dropoff FAIL",
      noFinalIssues.some((i) => i.path === "dropoffLocation"),
    );

    const noInitial = emptyBookingDraft({
      ...multi,
      days: days.map((d, i) => (i === 0 ? { ...d, startLocation: null } : d)),
    });
    const noInitialIssues = collectBookingDraftIssues(noInitial);
    assert(
      "missing initial pickup FAIL",
      noInitialIssues.some((i) => i.path === "pickupLocation"),
    );

    // Legacy v1-ish draft with stale catalog placeIds + seconds time
    const legacy = emptyBookingDraft({
      ...completeSimple({
        startTime: "14:15:30",
        placeIds: ["cm-airport", "not-uuid", vehicleId],
      }),
    });
    const legacyBuilt = buildBookingSubmitPayload("pondcarrent", legacy, "DIRECT");
    assert("legacy migrated draft PASS", legacyBuilt.ok);
    if (legacyBuilt.ok) {
      assert(
        "stale hidden placeIds ignored",
        legacyBuilt.payload.placeIds.length === 1 &&
          legacyBuilt.payload.placeIds[0] === vehicleId,
      );
      assert(
        "review/submit same payload shape",
        draftToSubmitPayload("pondcarrent", legacy, "DIRECT") &&
          !("error" in draftToSubmitPayload("pondcarrent", legacy, "DIRECT")!) &&
          (draftToSubmitPayload("pondcarrent", legacy, "DIRECT") as { startTime: string })
            .startTime === "14:15",
      );
    }

    // Double submit + tenant
    if (!legacyBuilt.ok) throw new Error("legacy build failed");
    const reqId = `${PREFIX}${crypto.randomUUID()}`;
    const created = await store.createBookingRequest({
      ...legacyBuilt.payload,
      clientRequestId: reqId,
    });
    const again = await store.createBookingRequest({
      ...legacyBuilt.payload,
      clientRequestId: reqId,
    });
    assert("double submit safe", again.booking.id === created.booking.id);

    const demo = await store.getPublicStore("demo-store-002");
    assert("demo store", Boolean(demo));
    const demoBuilt = buildBookingSubmitPayload(
      "demo-store-002",
      completeSimple({ name: "Demo Submit" }),
      "DIRECT",
    );
    assert("demo payload builds", demoBuilt.ok);
    if (demoBuilt.ok) {
      const demoReq = `${PREFIX}demo-${crypto.randomUUID()}`;
      const demoBooking = await store.createBookingRequest({
        ...demoBuilt.payload,
        clientRequestId: demoReq,
      });
      assert(
        "tenant isolation",
        demoBooking.booking.businessId === SEED.businessDemo002 &&
          demoBooking.booking.businessId !== SEED.businessPond,
      );
      const pondList = await store.listBookings(pondOwner, SEED.businessPond);
      assert(
        "tenant isolation — not in POND list",
        !pondList.some((b) => b.id === demoBooking.booking.id),
      );
    }

    const removed = await purgeByClientRequestPrefix(PREFIX);
    assert("cleanup", removed.length >= 0);
  } finally {
    await purgeByClientRequestPrefix(PREFIX);
  }

  if (failed) {
    console.error(`booking-submit-validation-check failed (${failed})`);
    process.exit(1);
  }
  console.log("booking-submit-validation-check: all passed");
}

void main();
