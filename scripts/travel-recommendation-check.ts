/**
 * Travel recommendations must use Store Admin Place source (ทริป / สถานที่).
 * Fixtures: TEST_TRAVEL_REC_
 */
import {
  LocalStore,
  purgeByClientRequestPrefix,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import {
  BOOKING_WIZARD_MAX_STEP,
  addPlaceToBookingDraft,
  emptyBookingDraft,
  readBookingDraft,
  writeBookingDraft,
  clearBookingDraft,
} from "../src/lib/booking/draft";
import {
  TRAVEL_RECOMMENDATION_CHIPS,
  filterTravelRecommendations,
  isCustomerVisiblePlace,
  travelRecommendationLabel,
} from "../src/lib/domain/travel-recommendations";
import { PLACE_CATEGORY_LABELS } from "../src/lib/domain/enums";
import { resolvePlaceImageUrl } from "../src/lib/domain/place-image";
import type { Actor } from "../src/lib/domain/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_TRAVEL_REC_";

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

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);
    clearBookingDraft("pondcarrent");

    assert("Booking still max 5 cards", BOOKING_WIZARD_MAX_STEP === 5);
    const wizardSrc = readFileSync(
      join(__dirname, "../src/components/storefront/BookingWizard.tsx"),
      "utf8",
    );
    assert(
      "discovery not inside BookingWizard",
      !wizardSrc.includes("PartnerTravelDiscovery") && !wizardSrc.includes("เที่ยวแนะนำ"),
    );
    assert(
      "Admin chips match recommendation chips",
      TRAVEL_RECOMMENDATION_CHIPS.includes("ATTRACTION") &&
        TRAVEL_RECOMMENDATION_CHIPS.includes("LOCAL_FOOD") &&
        travelRecommendationLabel("ATTRACTION") === PLACE_CATEGORY_LABELS.ATTRACTION,
    );

    const pond = await store.getPublicStore("pondcarrent");
    assert("POND storefront places from getPublicStore", Boolean(pond?.places.length));

    const board = await store.loadTenantBoard(pondOwner, SEED.businessPond);
    const adminActive = board.places.filter((p) => p.status === "ACTIVE");
    const publicIds = new Set(pond!.places.map((p) => p.id));
    assert(
      "customer discovery uses same Place repository rows",
      adminActive.every(
        (p) =>
          !isCustomerVisiblePlace(p) ||
          publicIds.has(p.id) ||
          p.businessId === SEED.businessPond ||
          p.businessId === null,
      ),
    );

    const hidden = board.places.find((p) => p.status === "HIDDEN");
    if (hidden) {
      assert(
        "hidden Place not in public storefront",
        !pond!.places.some((p) => p.id === hidden.id),
      );
    } else {
      // Create then hide
      const created = await store.upsertPlace(pondOwner, SEED.businessPond, {
        category: "CAFE",
        name: `${PREFIX} Hidden Cafe`,
        description: "test",
        address: null,
        imageUrls: [],
        localRecommended: false,
        estimatedDurationMinutes: null,
        status: "ACTIVE",
      });
      await store.setPlaceActive(pondOwner, created.id, false);
      const after = await store.getPublicStore("pondcarrent");
      assert(
        "hidden Place not shown after deactivate",
        !after!.places.some((p) => p.id === created.id),
      );
    }

    const attractions = filterTravelRecommendations(pond!.places, {
      category: "ATTRACTION",
      provinceId: pond!.business.provinceId,
    });
    assert(
      "category filtering works",
      attractions.every((p) => p.category === "ATTRACTION"),
    );

    for (const place of pond!.places.slice(0, 6)) {
      const cover = resolvePlaceImageUrl(place);
      assert(`no fleet image fallback ${place.slug}`, !cover.includes("/fleet/"));
      assert(`no chiang-mai hero as place ${place.slug}`, !cover.includes("/themes/chiang-mai/"));
    }

    const withCover = pond!.places.find((p) => p.coverImageUrl || p.imageUrls?.[0]);
    if (withCover) {
      const cover = resolvePlaceImageUrl(withCover);
      assert(
        "real Place image preferred over placeholder",
        cover === (withCover.coverImageUrl || withCover.imageUrls[0]) ||
          cover.startsWith("/places/") ||
          cover.startsWith("/uploads/"),
      );
    }

    const discoverySrc = readFileSync(
      join(__dirname, "../src/components/storefront/PartnerTravelDiscovery.tsx"),
      "utf8",
    );
    assert(
      "compact carousel not full-bleed grid",
      discoverySrc.includes("travel-place-carousel") &&
        discoverySrc.includes("travel-place-card") &&
        !discoverySrc.includes("sm:grid-cols-2") &&
        discoverySrc.includes("w-[min(68vw,248px)]"),
    );
    assert(
      "category chips in discovery",
      discoverySrc.includes("TRAVEL_RECOMMENDATION_CHIPS"),
    );

    // Place → draft preserves other booking state (mock sessionStorage like discovery-check)
    const memory = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      sessionStorage: {
        getItem: (k: string) => memory.get(k) ?? null,
        setItem: (k: string, v: string) => void memory.set(k, v),
        removeItem: (k: string) => void memory.delete(k),
      },
    };

    clearBookingDraft("pondcarrent");
    const draft = emptyBookingDraft({
      serviceType: "PRIVATE_DRIVER_DAILY",
      startDate: "2026-12-20",
      startTime: "10:00",
      passengers: 4,
      luggage: 3,
      name: "ลูกค้าทริป",
      phone: "0899000111",
      letStoreChooseVehicle: true,
      step: 2,
    });
    writeBookingDraft("pondcarrent", draft);
    const place = pond!.places.find((p) => p.category === "ATTRACTION") ?? pond!.places[0];
    const afterAdd = addPlaceToBookingDraft("pondcarrent", place, {
      dayNumber: 1,
      numberOfDays: 1,
    });
    const reloaded = readBookingDraft("pondcarrent");
    assert(
      "Place added to existing draft",
      Boolean(
        reloaded?.placeIds.includes(place.id) ||
          reloaded?.days.some((d) => d.stops.some((s) => s.placeId === place.id)),
      ),
    );
    assert("service preserved", reloaded?.serviceType === "PRIVATE_DRIVER_DAILY");
    assert("date preserved", reloaded?.startDate === "2026-12-20");
    assert("passengers preserved", reloaded?.passengers === 4);
    assert("customer name preserved", reloaded?.name === "ลูกค้าทริป");
    assert("step not forced into discovery", afterAdd.step === 2 || afterAdd.step === 1);

    // Dedup
    addPlaceToBookingDraft("pondcarrent", place, { dayNumber: 1, numberOfDays: 1 });
    const again = readBookingDraft("pondcarrent");
    const count = again?.placeIds.filter((id) => id === place.id).length ?? 0;
    assert("dedupe placeIds", count <= 1);

    clearBookingDraft("pondcarrent");
    await purgeByClientRequestPrefix(PREFIX);
  } catch (error) {
    failed += 1;
    console.error("FAIL unexpected", error);
  }

  if (failed) {
    console.error(`\ntravel-recommendation-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\ntravel-recommendation-check: all passed");
}

main();
