/**
 * Trip Package CMS → public catalog → existing Quick Booking regression checks.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  LocalStore,
  purgeTestBookings,
  purgeTestTripPackages,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { BOOKING_WIZARD_MAX_STEP, emptyBookingDraft } from "../src/lib/booking/draft";
import { buildBookingSubmitPayload } from "../src/lib/booking/submit";
import { packagePriceLabel } from "../src/components/storefront/TripPackageCard";
import { allowsTripPackages } from "../src/lib/domain/booking-entitlements";
import {
  localizedPackageText,
  mapPackageToBookingDraftPrefill,
  type TripPackageWriteInput,
} from "../src/lib/domain/trip-package";
import type { Actor } from "../src/lib/domain/types";
import { translate } from "../src/lib/i18n/translate";

const store = new LocalStore();
const TITLE_PREFIX = "TEST_TRIP_PACKAGE_";
const requestIds: string[] = [];
let failed = 0;

const pondOwner: Actor = {
  kind: "user",
  userId: SEED.userPondOwner,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessPond],
};

const pondStaff: Actor = {
  kind: "user",
  userId: SEED.userPondStaff,
  role: "BUSINESS_STAFF",
  businessIds: [SEED.businessPond],
};

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

function packageInput(
  source: Awaited<ReturnType<LocalStore["getPublicTripPackage"]>>,
): TripPackageWriteInput {
  if (!source) throw new Error("seed package missing");
  return {
    featured: true,
    displayOrder: 90,
    days: source.days,
    nights: source.nights,
    passengerMin: source.passengerMin,
    passengerMax: source.passengerMax,
    vehicleCategoryHint: source.vehicleCategoryHint,
    pricingMode: "QUOTE_FIRST",
    priceAmount: null,
    coverImageUrl: source.coverImageUrl,
    galleryImageUrls: source.galleryImageUrls,
    title: {
      th: `${TITLE_PREFIX}เชียงใหม่`,
      en: "Test Chiang Mai package",
      zh: "测试清迈套餐",
    },
    summary: source.summary,
    highlights: source.highlights,
    included: source.included,
    notIncluded: source.notIncluded,
    conditions: source.conditions,
    notes: source.notes,
    itinerary: structuredClone(source.itinerary),
  };
}

async function main() {
  try {
    await purgeTestTripPackages(TITLE_PREFIX);

    assert("Quick Booking remains exactly 5 cards", BOOKING_WIZARD_MAX_STEP === 5);
    assert("Starter has no Trip Package", !allowsTripPackages("starter"));
    assert("Pro has Trip Package", allowsTripPackages("pro"));
    assert("Business inherits Trip Package", allowsTripPackages("business"));

    const seed = await store.getPublicTripPackage(SEED.businessPond, SEED.tripPackageCm4d3n);
    assert("published seed package is public", Boolean(seed));
    assert("package has Thai content", Boolean(localizedPackageText("th", seed?.title)));
    assert("same package has English content", Boolean(localizedPackageText("en", seed?.title)));
    assert("same package has Chinese content", Boolean(localizedPackageText("zh", seed?.title)));

    const created = await store.createTripPackage(
      pondOwner,
      SEED.businessPond,
      packageInput(seed),
    );
    assert("new package starts as Draft", created.status === "DRAFT");
    assert(
      "Draft is not customer-visible",
      (await store.getPublicTripPackage(SEED.businessPond, created.id)) === null,
    );

    const published = await store.publishTripPackage(pondOwner, created.id);
    assert("package publishes", published.status === "PUBLISHED");
    assert(
      "published package becomes customer-visible",
      (await store.getPublicTripPackage(SEED.businessPond, created.id))?.id === created.id,
    );
    assert(
      "other tenant cannot read package",
      (await store.getPublicTripPackage(SEED.businessDemo002, created.id)) === null,
    );

    const fixedInput = packageInput(seed);
    fixedInput.title.th = `${TITLE_PREFIX}FIXED`;
    fixedInput.pricingMode = "FIXED_PRICE";
    fixedInput.priceAmount = 12_900;
    const fixed = await store.createTripPackage(pondOwner, SEED.businessPond, fixedInput);
    assert(
      "fixed price uses authoritative amount",
      packagePriceLabel(fixed, (key, vars) => translate("th", key, vars)).label ===
        "฿12,900 / ทริป",
    );

    const startingInput = packageInput(seed);
    startingInput.title.th = `${TITLE_PREFIX}STARTING`;
    startingInput.pricingMode = "STARTING_PRICE";
    startingInput.priceAmount = 12_900;
    const starting = await store.createTripPackage(
      pondOwner,
      SEED.businessPond,
      startingInput,
    );
    assert(
      "starting price localizes consistently",
      packagePriceLabel(starting, (key, vars) => translate("en", key, vars)).label ===
        "From ฿12,900" &&
        packagePriceLabel(starting, (key, vars) => translate("zh", key, vars)).label ===
          "฿12,900 起",
    );
    assert(
      "quote-first has no fake amount",
      created.pricingMode === "QUOTE_FIRST" &&
        created.priceAmount === null &&
        packagePriceLabel(created, (key, vars) => translate("en", key, vars)).label ===
          "Request a quote",
    );

    let invalidPriceBlocked = false;
    try {
      const invalidPrice = packageInput(seed);
      invalidPrice.title.th = `${TITLE_PREFIX}INVALID_PRICE`;
      invalidPrice.pricingMode = "FIXED_PRICE";
      invalidPrice.priceAmount = 0;
      await store.createTripPackage(pondOwner, SEED.businessPond, invalidPrice);
    } catch {
      invalidPriceBlocked = true;
    }
    assert("non-positive fixed price is rejected", invalidPriceBlocked);

    let staffBlocked = false;
    try {
      await store.updateTripPackage(pondStaff, created.id, { featured: false });
    } catch {
      staffBlocked = true;
    }
    assert("staff without Branding permission cannot mutate package", staffBlocked);

    let foreignPlaceBlocked = false;
    const invalid = packageInput(seed);
    invalid.title.th = `${TITLE_PREFIX}FOREIGN_PLACE`;
    // A UUID not present in the store/global Place catalog models an injected
    // foreign-tenant reference without creating a second test fixture.
    invalid.itinerary[0].stops[0].placeId = SEED.businessDemo002;
    try {
      await store.createTripPackage(pondOwner, SEED.businessPond, invalid);
    } catch {
      foreignPlaceBlocked = true;
    }
    assert("foreign or unknown Place reference is blocked", foreignPlaceBlocked);

    const prefill = mapPackageToBookingDraftPrefill(published, "en");
    assert("prefill keeps package attribution", prefill.tripPackageId === published.id);
    assert("prefill uses existing multi-day service", prefill.serviceType === "MULTI_DAY_TRIP");
    assert("prefill maps package itinerary", prefill.days?.length === published.days);

    const draft = emptyBookingDraft({ ...prefill, startDate: "2026-11-10" });
    const pickup = {
      label: "Chiang Mai Airport",
      address: null,
      latitude: null,
      longitude: null,
      placeId: null,
      placeType: null,
      customerNote: null,
      source: "MANUAL" as const,
    };
    const dropoff = { ...pickup, label: "Chiang Mai Hotel" };
    draft.days[0].startLocation = pickup;
    draft.days[draft.days.length - 1].endLocation = dropoff;
    draft.name = "Trip Package Customer";
    draft.phone = "0812345678";
    const requestId = randomUUID();
    requestIds.push(requestId);
    const built = buildBookingSubmitPayload("pondcarrent", draft, "DIRECT", {
      clientRequestId: requestId,
      sessionId: "trip-package-check",
    });
    assert("package draft builds with existing submit mapper", built.ok);
    if (built.ok) {
      const result = await store.createBookingRequest(built.payload);
      assert("created Booking retains package id", result.booking.tripPackageId === published.id);
      assert("package booking remains quote-first request", result.booking.status === "REQUESTED");
    }

    const buttonSource = readFileSync(
      path.join(process.cwd(), "src/components/storefront/BookPackageButton.tsx"),
      "utf8",
    );
    assert("package handoff uses existing wizard route", buttonSource.includes("?book=1"));
    assert("package handoff clears stale trip choices", buttonSource.includes("customer identity only"));

    const sectionSource = readFileSync(
      path.join(process.cwd(), "src/components/storefront/FeaturedTripPackages.tsx"),
      "utf8",
    );
    assert(
      "single and pair layouts avoid carousel controls",
      sectionSource.includes('data-package-layout=') &&
        sectionSource.includes('"single"') &&
        sectionSource.includes('"pair"') &&
        !sectionSource.includes("scrollByCards"),
    );
    const cardSource = readFileSync(
      path.join(process.cwd(), "src/components/storefront/TripPackageCard.tsx"),
      "utf8",
    );
    assert(
      "single desktop card is bounded and uses 16:9 cover",
      sectionSource.includes("max-w-[560px]") &&
        cardSource.includes('width === "single" ? "aspect-video"'),
    );
    assert(
      "3+ layout keeps mobile swipe and desktop grid",
      sectionSource.includes("snap-x") && sectionSource.includes("md:grid-cols-3"),
    );

    await store.unpublishTripPackage(pondOwner, created.id);
    assert(
      "unpublished package disappears publicly",
      (await store.getPublicTripPackage(SEED.businessPond, created.id)) === null,
    );
    await store.archiveTripPackage(pondOwner, created.id);
    const archived = await store.getTripPackage(pondOwner, created.id);
    assert("package archives without hard delete", archived?.status === "ARCHIVED");
  } finally {
    await purgeTestBookings(requestIds);
    await purgeTestTripPackages(TITLE_PREFIX);
  }

  if (failed) {
    console.error(`\ntrip-package-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\ntrip-package-check: all passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
