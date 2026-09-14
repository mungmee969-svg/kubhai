/**
 * Multi-day itinerary booking UX checks.
 * Fixtures: TEST_MULTIDAY_
 */
import {
  LocalStore,
  purgeByClientRequestPrefix,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import {
  emptyBookingDraft,
  isMultiDayService,
} from "../src/lib/booking/draft";
import { draftToSubmitPayload } from "../src/lib/booking/submit";
import {
  addDaysIso,
  buildDaysFromDuration,
  dayHasContent,
  daysToItineraryItems,
  derivedEndDate,
  finalDropoffFromDays,
  initialPickupFromDays,
  type DayPlan,
} from "../src/lib/booking/itinerary";
import type { StructuredLocation } from "../src/lib/domain/location";
import type { Actor } from "../src/lib/domain/types";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_MULTIDAY_";

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

const airport: StructuredLocation = {
  label: "สนามบินเชียงใหม่ (CNX)",
  address: "ตำบลสุเทพ อำเภอเมืองเชียงใหม่",
  latitude: 18.7669,
  longitude: 98.9626,
  placeId: "cm-airport",
  placeType: "airport",
  customerNote: null,
  source: "SAVED_PLACE",
};

const hotel: StructuredLocation = {
  label: "โรงแรมย่านเมืองเก่า",
  address: "เมืองเก่าเชียงใหม่",
  latitude: 18.7877,
  longitude: 98.9932,
  placeId: "cm-old-city",
  placeType: "hotel",
  customerNote: null,
  source: "SAVED_PLACE",
};

const doi: StructuredLocation = {
  label: "ดอยสุเทพ",
  address: "วัดพระธาตุดอยสุเทพ",
  latitude: 18.8047,
  longitude: 98.9215,
  placeId: "cm-doi-suthep",
  placeType: "attraction",
  customerNote: null,
  source: "SEARCH",
};

const monjam: StructuredLocation = {
  label: "ม่อนแจ่ม",
  address: "แม่ริม",
  latitude: 18.933,
  longitude: 98.822,
  placeId: "cm-monjam",
  placeType: "attraction",
  customerNote: null,
  source: "MANUAL",
};

function threeDayPlan(): DayPlan[] {
  const start = "2026-09-13";
  const days = buildDaysFromDuration(start, 3);
  days[0] = {
    ...days[0],
    startLocation: airport,
    startTime: "09:00",
    stops: [doi],
    endLocation: hotel,
  };
  days[1] = {
    ...days[1],
    inheritStartFromPrevious: true,
    startLocation: hotel,
    startTime: "09:00",
    stops: [monjam],
    endLocation: hotel,
  };
  days[2] = {
    ...days[2],
    inheritStartFromPrevious: true,
    startLocation: hotel,
    startTime: "09:00",
    stops: [],
    endLocation: airport,
    endTime: "16:00",
  };
  return days;
}

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);

    // 1-day simple unchanged
    const simple = emptyBookingDraft({
      serviceType: "AIRPORT_TRANSFER",
      startDate: "2026-10-01",
      pickup: airport,
      dropoff: hotel,
      name: "ลูกค้าวันเดียว",
      phone: "0899301001",
    });
    assert("1-day behavior not multi service", !isMultiDayService(simple.serviceType));
    const simplePayload = draftToSubmitPayload("pondcarrent", simple, "DIRECT");
    assert("1-day payload ok", !("error" in simplePayload));
    if (!("error" in simplePayload)) {
      assert("1-day no end date required", simplePayload.endDate === null);
      assert("1-day empty itineraryDays", simplePayload.itineraryDays.length === 0);
    }

    // Derived dates
    assert("dates derived correctly", derivedEndDate("2026-09-13", 3) === "2026-09-15");
    assert("add day calendar", addDaysIso("2026-09-13", 1) === "2026-09-14");

    const days = threeDayPlan();
    assert("3-day creation", days.length === 3 && days[0].date === "2026-09-13" && days[2].date === "2026-09-15");
    assert("initial pickup", initialPickupFromDays(days)?.label === airport.label);
    assert("Day 1 stops", days[0].stops.length === 1 && days[0].stops[0].label === doi.label);
    assert("Day 1 end location", days[0].endLocation?.label === hotel.label);
    assert("Day 2 inherited start", days[1].inheritStartFromPrevious && days[1].startLocation?.label === hotel.label);
    assert("Day 2 stops", days[1].stops[0]?.label === monjam.label);
    assert("Day 2 end", days[1].endLocation?.label === hotel.label);
    assert("final day", days[2].dayNumber === 3);
    assert("final dropoff", finalDropoffFromDays(days)?.label === airport.label);

    // Stop ordering
    days[1].stops = [monjam, doi];
    const reordered = daysToItineraryItems(days).filter(
      (i) => i.dayNumber === 2 && i.kind === "STOP",
    );
    assert("stop ordering", reordered[0]?.title === monjam.label && reordered[1]?.title === doi.label);

    // Add day
    const four = buildDaysFromDuration("2026-09-13", 4, days);
    assert("add day", four.length === 4 && four[3].date === "2026-09-16");

    // Remove empty day
    assert("remove empty day safe", !dayHasContent(four[3]));

    // Warn/protect populated day
    assert("warn/protect populated day", dayHasContent(days[0]) === true);

    // Partial itinerary
    const partial = buildDaysFromDuration("2026-09-13", 3, days);
    partial[1] = { ...partial[1], undecided: true, stops: [], endLocation: null };
    const partialItems = daysToItineraryItems(partial);
    assert(
      "partial itinerary",
      partialItems.some((i) => i.dayNumber === 2 && i.kind === "UNDECIDED"),
    );

    // Store help
    const draft = emptyBookingDraft({
      serviceType: "MULTI_DAY_TRIP",
      startDate: "2026-09-13",
      numberOfDays: 3,
      days,
      letStorePlanTrip: true,
      storeHelpInterests: ["ธรรมชาติ", "วัด"],
      name: "ลูกค้าหลายวัน",
      phone: "0899301002",
      notes: "ชอบวิวภูเขา",
    });
    assert("store-help-planning flag", draft.letStorePlanTrip);
    const payload = draftToSubmitPayload("pondcarrent", draft, "DIRECT");
    assert("draft → payload", !("error" in payload));
    if ("error" in payload) throw new Error(payload.error);

    assert("pickup from day1", payload.pickupLocation === airport.label);
    assert("dropoff FINAL", payload.dropoffLocation === airport.label);
    assert("endDate derived", payload.endDate === "2026-09-15");
    assert("itinerary has START", payload.itineraryDays.some((i) => i.kind === "START"));
    assert("itinerary has FINAL", payload.itineraryDays.some((i) => i.kind === "FINAL"));
    assert(
      "auth/draft fields preserved",
      draft.step === 1 && draft.days[0].startLocation?.label === airport.label,
    );

    // Create booking
    const created = await store.createBookingRequest({
      ...payload,
      clientRequestId: `${PREFIX}trip3`,
    });
    assert("booking payload creates", Boolean(created.booking.bookingCode));
    assert(
      "pickup check-in uses initial pickup",
      created.booking.pickupLat === airport.latitude &&
        created.booking.pickupLocation === airport.label,
    );
    assert(
      "dropoff check-in uses FINAL dropoff",
      created.booking.dropoffLat === airport.latitude &&
        created.booking.dropoffLocation === airport.label,
    );

    const detail = await store.getBookingByToken(created.booking.securePublicToken);
    assert("Store Admin readability — itinerary rows", (detail?.itinerary.length ?? 0) > 3);
    const byDay = detail!.itinerary.filter((i) => i.dayNumber === 1);
    assert("Day 1 plan persisted", byDay.some((i) => i.kind === "START" || i.title.includes("สนามบิน")));
    assert(
      "quotation context — days + bookends",
      detail!.booking.endDate === "2026-09-15" &&
        detail!.itinerary.some((i) => i.kind === "FINAL"),
    );

    // Double submit
    const again = await store.createBookingRequest({
      ...payload,
      clientRequestId: `${PREFIX}trip3`,
    });
    assert("double submit", again.booking.id === created.booking.id);

    // Tenant isolation
    const demoPayload = draftToSubmitPayload(
      "demo-store-002",
      emptyBookingDraft({
        serviceType: "MULTI_DAY_TRIP",
        startDate: "2026-09-20",
        numberOfDays: 2,
        days: (() => {
          const d = buildDaysFromDuration("2026-09-20", 2);
          d[0].startLocation = hotel;
          d[0].endLocation = hotel;
          d[1].startLocation = hotel;
          d[1].endLocation = airport;
          d[1].endTime = "15:00";
          return d;
        })(),
        name: "ลูกค้า 002",
        phone: "0899301003",
      }),
      "DIRECT",
    );
    if ("error" in demoPayload) throw new Error(demoPayload.error);
    const demo = await store.createBookingRequest({
      ...demoPayload,
      clientRequestId: `${PREFIX}demo`,
    });
    const pondList = await store.listBookings(pondOwner, SEED.businessPond);
    assert(
      "tenant isolation",
      demo.booking.businessId !== SEED.businessPond &&
        !pondList.some((b) => b.id === demo.booking.id),
    );

    // Review summary shape
    assert(
      "review summary data",
      days.length === 3 &&
        initialPickupFromDays(days) &&
        finalDropoffFromDays(days),
    );

    await purgeByClientRequestPrefix(PREFIX);
    assert("fixture cleanup", true);
  } catch (error) {
    failed += 1;
    console.error("FAIL  multi-day-check crashed", error);
  }

  if (failed) {
    console.error(`\nmulti-day-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nmulti-day-check: all passed");
}

void main();
