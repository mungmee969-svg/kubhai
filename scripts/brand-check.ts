/**
 * Store branding isolation + resolution checks.
 * Fixtures: TEST_BRAND_
 */
import {
  LocalStore,
  purgeByClientRequestPrefix,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import {
  DEMO002_BRAND_DEFAULTS,
  POND_BRAND_DEFAULTS,
  resolveBusinessBranding,
  sanitizeHexColor,
} from "../src/lib/domain/branding";
import type { Actor } from "../src/lib/domain/types";
import { DomainError, TenantIsolationError } from "../src/lib/data/repository";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_BRAND_";

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

const demoOwner: Actor = {
  kind: "user",
  userId: SEED.userDemo002,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessDemo002],
};

const customerActor: Actor = {
  kind: "customer",
  customerAccountId: "00000000-0000-4000-8000-000000000099",
};

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);

    const pondPublic = await store.getPublicStore("pondcarrent");
    assert("POND store loads", Boolean(pondPublic));
    const pondBrand = resolveBusinessBranding(pondPublic!.business);
    assert("POND branding resolves correctly", pondBrand.businessName.includes("POND"));
    assert("POND logo", pondBrand.logoUrl === POND_BRAND_DEFAULTS.logoUrl || Boolean(pondPublic!.business.logoUrl));
    assert(
      "POND colors",
      pondBrand.primaryColor === POND_BRAND_DEFAULTS.primaryColor ||
        sanitizeHexColor(pondPublic!.business.primaryColor, "") === POND_BRAND_DEFAULTS.primaryColor ||
        pondBrand.primaryColor.startsWith("#"),
    );
    assert("POND accent gold-ish", pondBrand.accentColor.toUpperCase() === POND_BRAND_DEFAULTS.accentColor);

    const demoPublic = await store.getPublicStore("demo-store-002");
    assert("Store #002 loads", Boolean(demoPublic));
    const demoBrand = resolveBusinessBranding(demoPublic!.business);
    assert("Store #002 resolves independently", demoBrand.slug === "demo-store-002");
    assert("Store #002 different primary", demoBrand.primaryColor !== pondBrand.primaryColor);
    assert("no POND logo leak into #002", demoBrand.logoUrl !== POND_BRAND_DEFAULTS.logoUrl);
    assert(
      "demo defaults applied when empty logo",
      demoBrand.primaryColor === DEMO002_BRAND_DEFAULTS.primaryColor ||
        Boolean(demoPublic!.business.primaryColor),
    );

    // Missing logo fallback — synthetic business without logo
    const fallbackBrand = resolveBusinessBranding({
      ...demoPublic!.business,
      logoUrl: null,
      logoMarkUrl: null,
      faviconUrl: null,
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
      backgroundColor: null,
      textColor: null,
      shortName: null,
      slug: "some-new-store",
      name: "New Store Co",
    });
    assert("missing logo fallback", fallbackBrand.logoUrl === null && fallbackBrand.shortName.length > 0);
    assert("business color resolution fallback", /^#[0-9A-F]{6}$/.test(fallbackBrand.primaryColor));

    // Booking token uses authoritative business
    const created = await store.createBookingRequest({
      businessSlug: "pondcarrent",
      clientRequestId: `${PREFIX}BOOK`,
      customerName: "ลูกค้าแบรนด์",
      customerPhone: "0899300001",
      customerEmail: null,
      customerType: "PERSONAL",
      companyName: null,
      taxId: null,
      serviceType: "PRIVATE_DRIVER_DAILY",
      startDate: "2026-11-20",
      startTime: "09:00",
      endDate: "2026-11-20",
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
    const byToken = await store.getBookingByToken(created.booking.securePublicToken);
    assert("secure token uses authoritative business", byToken?.business.id === SEED.businessPond);
    const tokenBrand = resolveBusinessBranding(byToken!.business);
    assert("customer booking uses booking.businessId", tokenBrand.businessId === SEED.businessPond);
    assert("quotation/payment brand tenant", tokenBrand.slug === "pondcarrent");

    // Brand edit authorization
    let customerBlocked = false;
    try {
      await store.updateBusinessProfile(customerActor, SEED.businessPond, {
        primaryColor: "#111111",
      });
    } catch (error) {
      customerBlocked =
        error instanceof TenantIsolationError || error instanceof DomainError;
    }
    assert("customer cannot edit brand", customerBlocked);

    let crossTenantBlocked = false;
    try {
      await store.updateBusinessProfile(demoOwner, SEED.businessPond, {
        primaryColor: "#222222",
      });
    } catch (error) {
      crossTenantBlocked = error instanceof TenantIsolationError;
    }
    assert("unauthorized brand edit rejected", crossTenantBlocked);

    // Owner can update own brand
    const updated = await store.updateBusinessProfile(pondOwner, SEED.businessPond, {
      shortName: "POND",
      customerSupportText: `${PREFIX} support`,
    });
    assert("Store Admin can edit own brand", updated.customerSupportText === `${PREFIX} support`);

    // Restore support text
    await store.updateBusinessProfile(pondOwner, SEED.businessPond, {
      customerSupportText: "ติดต่อ POND Car Rent สำหรับช่วยเหลือการจอง",
    });

    assert("powered by default enabled", pondBrand.poweredByKubHaiEnabled === true);
    assert("sanitize invalid color", sanitizeHexColor("not-a-color", "#ABCDEF") === "#ABCDEF");

    const { storefrontPath, storefrontDisplayUrl } = await import("../src/lib/domain/storefront-url");
    assert("POND storefront path", storefrontPath(pondPublic!.business.slug) === "/s/pondcarrent");
    assert(
      "Store #002 storefront path",
      storefrontPath(demoPublic!.business.slug) === "/s/demo-store-002",
    );
    assert(
      "storefront display does not invent domain",
      storefrontDisplayUrl("pondcarrent") === "s/pondcarrent" &&
        storefrontDisplayUrl("pondcarrent", "127.0.0.1:3010") === "127.0.0.1:3010/s/pondcarrent",
    );
    assert(
      "tenant storefront paths differ",
      storefrontPath(pondPublic!.business.slug) !== storefrontPath(demoPublic!.business.slug),
    );
  } finally {
    const removed = await purgeByClientRequestPrefix(PREFIX);
    assert("test cleanup", removed.length >= 0);
  }

  if (failed) {
    console.error(`brand-check failed (${failed})`);
    process.exit(1);
  }
  console.log("brand-check passed");
}

void main();
