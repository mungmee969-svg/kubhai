/**
 * White-label booking themes + plan entitlements.
 * Fixtures: TEST_BOOKING_THEME_
 */
import {
  LocalStore,
  purgeByClientRequestPrefix,
  setBusinessSubscriptionPlanForTests,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { resolveBusinessBranding, POND_BRAND_DEFAULTS } from "../src/lib/domain/branding";
import {
  hasBookingCapability,
  normalizeSubscriptionPlan,
} from "../src/lib/domain/booking-entitlements";
import {
  BOOKING_LOCATION_THEME_FIXTURES,
  resolveBookingLocationTheme,
} from "../src/lib/domain/booking-location-theme";
import { resolveBookingPresentation } from "../src/lib/domain/booking-presentation";
import type { Actor, Business } from "../src/lib/domain/types";
import { DomainError } from "../src/lib/data/repository";
import { existsSync } from "node:fs";
import path from "node:path";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_BOOKING_THEME_";
const CUSTOM_HERO = "/themes/chiang-mai/hero-desktop.jpg";

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

    const cmAsset = path.join(process.cwd(), "public/themes/chiang-mai/hero-desktop.jpg");
    assert("Chiang Mai hero asset exists on disk", existsSync(cmAsset));

    const cmTheme = resolveBookingLocationTheme({ provinceSlug: "chiang-mai" });
    assert("Chiang Mai theme id", cmTheme.themeId === "location.chiang-mai");
    assert(
      "Chiang Mai desktop hero path",
      cmTheme.desktopHeroImage === "/themes/chiang-mai/hero-desktop.jpg",
    );
    assert(
      "no POND path in location theme",
      !cmTheme.desktopHeroImage.includes("pond") && !cmTheme.desktopHeroImage.includes("/fleet/"),
    );

    const north = resolveBookingLocationTheme({ provinceSlug: "chiang-rai" });
    assert("Chiang Rai → northern theme", north.themeId === BOOKING_LOCATION_THEME_FIXTURES.NORTHERN.themeId);

    const generic = resolveBookingLocationTheme({});
    assert("empty location → KubHai generic", generic.themeId === "location.kubhai-travel");

    const pondPublic = await store.getPublicStore("pondcarrent");
    const demoPublic = await store.getPublicStore("demo-store-002");
    assert("POND + demo load", Boolean(pondPublic && demoPublic));

    const pondPres = resolveBookingPresentation({
      business: pondPublic!.business,
      province: pondPublic!.province,
      region: pondPublic!.region,
    });
    const demoPres = resolveBookingPresentation({
      business: demoPublic!.business,
      province: demoPublic!.province,
      region: demoPublic!.region,
    });

    assert("POND Chiang Mai location theme", pondPres.locationTheme.themeId === "location.chiang-mai");
    assert("Demo Chiang Mai location theme", demoPres.locationTheme.themeId === "location.chiang-mai");
    assert(
      "two Chiang Mai partners share location hero",
      pondPres.hero.desktopUrl === demoPres.hero.desktopUrl &&
        pondPres.hero.desktopUrl === "/themes/chiang-mai/hero-desktop.jpg",
    );
    assert("POND brand independent", pondPres.brand.businessName.includes("POND"));
    assert("Demo brand independent", demoPres.brand.slug === "demo-store-002");
    assert(
      "no logo cross-leak",
      pondPres.brand.logoUrl !== demoPres.brand.logoUrl || demoPres.brand.logoUrl === null,
    );
    assert(
      "hero is not vehicle cover",
      pondPres.hero.desktopUrl !== "/fleet/suv.jpg" &&
        pondPres.hero.desktopUrl !== pondPublic!.business.coverUrl,
    );
    assert("POND default PRO", normalizeSubscriptionPlan(pondPublic!.business.subscriptionPlan) === "pro");
    assert("starter cannot custom hero capability", !hasBookingCapability("starter", "booking.customHero"));
    assert("partner alias is starter", normalizeSubscriptionPlan("partner") === "starter");
    assert("pro can custom hero", hasBookingCapability("pro", "booking.customHero"));

    // Starter cannot activate premium custom hero (server) — temporarily downgrade POND
    await setBusinessSubscriptionPlanForTests(SEED.businessPond, "starter");
    let starterRejected = false;
    try {
      await store.updateBusinessProfile(pondOwner, SEED.businessPond, {
        bookingHeroImageUrl: CUSTOM_HERO,
      });
    } catch (error) {
      starterRejected = error instanceof DomainError;
    }
    assert("Starter cannot save customHero (server)", starterRejected);

    // Pro can save; downgrade keeps config but stops rendering
    await setBusinessSubscriptionPlanForTests(SEED.businessPond, "pro");
    await store.updateBusinessProfile(pondOwner, SEED.businessPond, {
      bookingHeroImageUrl: CUSTOM_HERO,
      bookingTagline: "ทริปโปรของร้าน",
    });
    const pondPro = await store.getPublicStore("pondcarrent");
    const proPres = resolveBookingPresentation({
      business: pondPro!.business,
      province: pondPro!.province,
      region: pondPro!.region,
    });
    assert("Pro activates custom hero", proPres.hero.source === "custom");
    assert("Pro custom tagline shown", proPres.displayTagline === "ทริปโปรของร้าน");
    assert("stored hero on business", pondPro!.business.bookingHeroImageUrl === CUSTOM_HERO);

    // Cross-store isolation: demo must not inherit POND custom hero
    const demoAfter = await store.getPublicStore("demo-store-002");
    const demoAfterPres = resolveBookingPresentation({
      business: demoAfter!.business,
      province: demoAfter!.province,
      region: demoAfter!.region,
    });
    assert(
      "custom hero never leaks to other business",
      demoAfter!.business.bookingHeroImageUrl == null &&
        demoAfterPres.hero.source !== "custom" &&
        demoAfterPres.hero.desktopUrl === "/themes/chiang-mai/hero-desktop.jpg",
    );

    // Downgrade: retain config, fall back to location theme
    await setBusinessSubscriptionPlanForTests(SEED.businessPond, "starter");
    const pondDown = await store.getPublicStore("pondcarrent");
    const downPres = resolveBookingPresentation({
      business: pondDown!.business,
      province: pondDown!.province,
      region: pondDown!.region,
    });
    assert(
      "downgrade retains stored custom hero",
      pondDown!.business.bookingHeroImageUrl === CUSTOM_HERO,
    );
    assert(
      "downgrade stops rendering custom hero",
      downPres.hero.source !== "custom" &&
        downPres.hero.desktopUrl === "/themes/chiang-mai/hero-desktop.jpg",
    );
    assert("downgrade inactive flag", downPres.customHeroRetainedButInactive === true);
    assert(
      "downgrade hides premium tagline from display",
      downPres.displayTagline !== "ทริปโปรของร้าน",
    );

    // Restore POND to PRO + clear custom fields while entitled
    await setBusinessSubscriptionPlanForTests(SEED.businessPond, "pro");
    await store.updateBusinessProfile(pondOwner, SEED.businessPond, {
      bookingHeroImageUrl: null,
      bookingMobileHeroImageUrl: null,
      bookingTagline: null,
    });
    // Leave POND on PRO (pilot lock)

    // Booking logic / quote-first unchanged
    assert("POND quote-first unchanged", pondPublic!.business.commercialModel === "QUOTE_FIRST");
    assert("Demo quote-first unchanged", demoPublic!.business.commercialModel === "QUOTE_FIRST");

    const created = await store.createBookingRequest({
      businessSlug: "pondcarrent",
      clientRequestId: `${PREFIX}BOOK`,
      customerName: "ลูกค้าธีม",
      customerPhone: "0899400001",
      customerEmail: null,
      customerType: "PERSONAL",
      companyName: null,
      taxId: null,
      serviceType: "PRIVATE_DRIVER_DAILY",
      startDate: "2026-12-01",
      startTime: "09:00",
      endDate: "2026-12-01",
      endTime: "17:00",
      passengerCount: 2,
      luggageCount: 1,
      pickupLocation: "นิมมาน",
      dropoffLocation: "สนามบิน",
      tripNotes: null,
      letStorePlanTrip: false,
      preferredVehicleId: null,
      placeIds: [],
      source: "DIRECT",
      sessionId: `${PREFIX}BOOK`,
      referrer: null,
    });
    assert("booking still creates under themed store", Boolean(created.booking.securePublicToken));
    assert("booking businessId scoped", created.booking.businessId === SEED.businessPond);

    // Brand identity still POND defaults for logo path when logo set
    const pondBrand = resolveBusinessBranding(pondDown!.business);
    assert(
      "partner branding still resolves",
      pondBrand.primaryColor === POND_BRAND_DEFAULTS.primaryColor ||
        pondBrand.logoUrl === POND_BRAND_DEFAULTS.logoUrl,
    );

    // Synthetic: business plan entitlements do not fork layout default
    const synth: Business = {
      ...pondPublic!.business,
      subscriptionPlan: "business",
      bookingLayoutPreset: "compact-6-card",
    };
    const bizPres = resolveBookingPresentation({
      business: synth,
      province: pondPublic!.province,
      region: pondPublic!.region,
    });
    assert("business layout preset unlocks", bizPres.layoutPreset === "compact-6-card");

    await purgeByClientRequestPrefix(PREFIX);
  } catch (error) {
    failed += 1;
    console.error("FAIL  unexpected", error);
    try {
      await setBusinessSubscriptionPlanForTests(SEED.businessPond, "pro");
      await purgeByClientRequestPrefix(PREFIX);
    } catch {
      /* ignore cleanup */
    }
  }

  if (failed) {
    console.error(`\nbooking-theme-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nbooking-theme-check: all passed");
}

main();
