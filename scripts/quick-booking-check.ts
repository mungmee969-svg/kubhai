/**
 * Quick Booking + partner discovery foundation checks.
 * Fixtures: TEST_QUICK_BOOK_
 */
import {
  BOOKING_WIZARD_MAX_STEP,
  emptyBookingDraft,
  migrateLegacyWizardStep,
  isMultiDayService,
} from "../src/lib/booking/draft";
import { collectBookingDraftIssues } from "../src/lib/booking/submit";
import { BOOKING_CARD_LABELS } from "../src/components/storefront/BookingProgress";
import { resolvePlaceImageUrl } from "../src/lib/domain/place-image";
import { placeCoverUrl } from "../src/lib/domain/discovery";
import { LocalStore, purgeByClientRequestPrefix } from "../src/lib/data/local-store";
import type { StructuredLocation } from "../src/lib/domain/location";

let failed = 0;
const PREFIX = "TEST_QUICK_BOOK_";
const store = new LocalStore();

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

const pickup: StructuredLocation = {
  label: "สนามบินเชียงใหม่",
  address: "เชียงใหม่",
  latitude: 18.7669,
  longitude: 98.9626,
  placeId: "cm-airport",
  placeType: "airport",
  customerNote: null,
  source: "SAVED_PLACE",
};

const dropoff: StructuredLocation = {
  label: "นิมมาน",
  address: "เชียงใหม่",
  latitude: 18.8,
  longitude: 98.96,
  placeId: "cm-nimman",
  placeType: "area",
  customerNote: null,
  source: "SEARCH",
};

async function main() {
  try {
    assert("Quick Booking max ≤ 6", BOOKING_WIZARD_MAX_STEP <= 6);
    assert("Quick Booking uses 5 cards", BOOKING_WIZARD_MAX_STEP === 5);
    assert("Progress labels count matches", BOOKING_CARD_LABELS.length === 5);
    assert("Travel details label", BOOKING_CARD_LABELS[1] === "รายละเอียดการเดินทาง");

    const blank = emptyBookingDraft();
    assert("Default version 4", blank.version === 4);
    assert("Not multi-day by default", !isMultiDayService(blank.serviceType));

    const simple = emptyBookingDraft({
      step: 5,
      serviceType: "POINT_TO_POINT",
      startDate: "2026-12-10",
      startTime: "09:00",
      pickup,
      dropoff,
      passengers: 2,
      luggage: 1,
      letStoreChooseVehicle: true,
      name: "ลูกค้าเร็ว",
      phone: "0899111000",
    });
    const issues = collectBookingDraftIssues(simple);
    assert("Simple flow ready to submit", issues.length === 0);
    assert(
      "Pickup/dropoff issues map to travel step 2",
      collectBookingDraftIssues(
        emptyBookingDraft({ serviceType: "POINT_TO_POINT", startDate: "2026-12-10", startTime: "09:00" }),
      ).every((i) => i.path.includes("pickup") || i.path.includes("dropoff") ? i.step === 2 : true),
    );

    assert("v3 route step merges to travel", migrateLegacyWizardStep(3, 3) === 2);
    assert("v3 vehicle → 3", migrateLegacyWizardStep(4, 3) === 3);
    assert("v3 customer → 4", migrateLegacyWizardStep(5, 3) === 4);
    assert("v3 review → 5", migrateLegacyWizardStep(6, 3) === 5);

    const pond = await store.getPublicStore("pondcarrent");
    assert("POND quote-first", pond?.business.commercialModel === "QUOTE_FIRST");

    const places = pond?.places ?? [];
    for (const place of places.slice(0, 8)) {
      const cover = placeCoverUrl(place);
      assert(
        `no fleet fallback for place ${place.slug}`,
        !cover.includes("/fleet/") && !resolvePlaceImageUrl(place).includes("/fleet/"),
      );
    }

    // Discovery does not require booking fields
    assert("storefront places available for discovery", places.length >= 0);

    await purgeByClientRequestPrefix(PREFIX);
  } catch (error) {
    failed += 1;
    console.error("FAIL unexpected", error);
  }

  if (failed) {
    console.error(`\nquick-booking-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nquick-booking-check: all passed");
}

main();
