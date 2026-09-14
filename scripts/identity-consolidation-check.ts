/**
 * Platform consolidation: identity, images, partner types, attribution foundation.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LocalStore, purgeByClientRequestPrefix, purgeCustomerAuthFixtures } from "../src/lib/data/local-store";
import { placeCoverUrl } from "../src/lib/domain/discovery";
import {
  categoryPlaceholderUrl,
  isFleetImageUrl,
  isValidPlaceImageUrl,
  resolvePlaceImageUrl,
} from "../src/lib/domain/place-image";
import {
  externalContentAttribution,
  normalizeExternalContent,
  isDisplayableExternalContent,
} from "../src/lib/domain/external-content";
import { CUSTOMER_SESSION_COOKIE } from "../src/lib/auth/customer-session-token";
import { normalizePhone } from "../src/lib/domain/customer-auth";
import { PILOT_DEV_OTP } from "../src/lib/auth/otp";
import { SEED } from "../src/lib/data/seed-ids";

const root = join(__dirname, "..");
let failed = 0;
const PREFIX = "TEST_CONSOL_";
const PHONE = "0893344556";
const PHONE_PREFIX = "08933";

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

async function main() {
  const landing = read("src/components/marketing/KubHaiLanding.tsx");
  const placeImage = read("src/lib/domain/place-image.ts");
  const placeCard = read("src/components/discovery/PlaceCard.tsx");
  const customerAuth = read("src/lib/domain/customer-auth.ts");
  const wizard = read("src/components/storefront/BookingWizard.tsx");
  const sessionSrc = read("src/lib/auth/session.ts");

  assert("travel positioning headline", landing.includes("เที่ยวเหนือ ไปกับขับให้"));
  assert("travel + mobility balance", landing.includes("เที่ยว • กิน • ช้อป • พัก • เดินทาง"));
  assert("partner not KubHai fleet claim", landing.includes("ไม่ใช่รถของ KubHai เอง"));
  assert("hero is discovery not fleet", landing.includes("DISCOVERY_HERO_IMAGE"));
  assert("no fleet fallback in PlaceCard", !placeCard.includes("/fleet/"));
  assert("place-image rejects fleet", placeImage.includes("isFleetImageUrl"));
  assert("central identity documented", customerAuth.includes("ONE CENTRAL"));
  assert("customer session cookie name", CUSTOMER_SESSION_COOKIE === "kh_customer_session");
  assert("staff session separate cookie", sessionSrc.includes("kh_session") && !sessionSrc.includes("kh_customer_session"));
  assert("guest browse messaging", read("src/components/discovery/HomeDiscovery.tsx").includes("ไม่ต้องเข้าสู่ระบบ"));
  // Pilot: booking path no longer pushes multi-partner customer accounts
  assert("booking wizard is guest-first", !wizard.includes("BookingAuthSheet"));
  assert(
    "customer account architecture retained",
    read("src/lib/domain/customer-auth.ts").includes("CustomerAccount") &&
      read("src/app/account/login/page.tsx").length > 50,
  );

  for (const name of [
    "attraction",
    "restaurant",
    "cafe",
    "hotel",
    "relaxation",
    "activity",
    "shopping",
    "souvenir",
    "hero-north",
  ]) {
    assert(`placeholder exists ${name}`, existsSync(join(root, `public/discovery/placeholders/${name}.svg`)));
  }

  assert("fleet URL detected", isFleetImageUrl("/fleet/suv.jpg"));
  assert("fleet URL invalid for place", !isValidPlaceImageUrl("/fleet/suv.jpg"));
  assert("discovery placeholder valid", isValidPlaceImageUrl("/discovery/placeholders/cafe.svg"));
  assert(
    "resolve ignores fleet cover",
    resolvePlaceImageUrl({
      coverImageUrl: "/fleet/suv.jpg",
      imageUrls: ["/fleet/van.jpg"],
      category: "ATTRACTION",
    }) === categoryPlaceholderUrl("ATTRACTION"),
  );

  const store = new LocalStore();
  const places = await store.listPublicPlaces({ provinceSlug: "chiang-mai" });
  assert("places load", places.length >= 8);
  assert(
    "no place cover is fleet",
    places.every((p) => !isFleetImageUrl(placeCoverUrl(p))),
  );
  assert(
    "no seed place stores fleet cover",
    places.every((p) => !isFleetImageUrl(p.coverImageUrl) && !(p.imageUrls ?? []).some(isFleetImageUrl)),
  );
  assert(
    "no fabricated sponsored badge data",
    places.every((p) => !p.sponsored),
  );
  assert(
    "area/guide kinds present",
    places.some((p) => p.placeKind === "AREA" || p.placeKind === "GUIDE"),
  );
  assert(
    "relaxation category present",
    places.some((p) => p.category === "RELAXATION"),
  );

  const pond = await store.getPublicStore("pondcarrent");
  const demo = await store.getPublicStore("demo-store-002");
  assert("POND QUOTE_FIRST", pond?.business.commercialModel === "QUOTE_FIRST");
  assert("POND partner types include chauffeur", pond?.business.partnerServiceTypes?.includes("CHAUFFEUR"));
  assert("demo partner types exist", (demo?.business.partnerServiceTypes?.length ?? 0) > 0);
  assert("POND business id", pond?.business.id === SEED.businessPond);
  assert(
    "demo business id isolated",
    demo?.business.id === SEED.businessDemo002 && demo?.business.id !== SEED.businessPond,
  );

  // Cleanup prior fixtures
  await purgeByClientRequestPrefix(PREFIX);
  await purgeCustomerAuthFixtures(PHONE_PREFIX);

  try {
  const start = await store.startCustomerSignup(PHONE);
  assert("signup OTP issued", Boolean(start.challengeId));
  const account = await store.completeCustomerSignup({
    challengeId: start.challengeId,
    code: (start as { devCode?: string }).devCode || PILOT_DEV_OTP,
    password: "TestPass123!",
    displayName: `${PREFIX}User`,
  });
  assert("central account created", Boolean(account?.id));
  const accountId = account.id;

  let dupFailed = false;
  try {
    await store.startCustomerSignup(PHONE);
  } catch {
    dupFailed = true;
  }
  assert("duplicate phone rejected", dupFailed);

  const bookingPond = await store.createBookingRequest({
    businessSlug: "pondcarrent",
    clientRequestId: `${PREFIX}POND`,
    customerName: `${PREFIX}User`,
    customerPhone: PHONE,
    customerEmail: null,
    customerType: "PERSONAL",
    companyName: null,
    taxId: null,
    serviceType: "PRIVATE_DRIVER_DAILY",
    startDate: "2026-11-01",
    startTime: "09:00",
    endDate: "2026-11-01",
    endTime: "17:00",
    passengerCount: 2,
    luggageCount: 1,
    pickupLocation: "CNX",
    dropoffLocation: "Old City",
    tripNotes: null,
    letStorePlanTrip: false,
    preferredVehicleId: null,
    placeIds: [],
    source: "DIRECT",
    sessionId: `${PREFIX}POND`,
    referrer: null,
  });
  assert("booking linked to central account", bookingPond.booking.customerAccountId === accountId);

  const bookingDemo = await store.createBookingRequest({
    businessSlug: "demo-store-002",
    clientRequestId: `${PREFIX}DEMO`,
    customerName: `${PREFIX}User`,
    customerPhone: PHONE,
    customerEmail: null,
    customerType: "PERSONAL",
    companyName: null,
    taxId: null,
    serviceType: "PRIVATE_DRIVER_DAILY",
    startDate: "2026-11-02",
    startTime: "10:00",
    endDate: "2026-11-02",
    endTime: "18:00",
    passengerCount: 2,
    luggageCount: 1,
    pickupLocation: "Hotel",
    dropoffLocation: "Airport",
    tripNotes: null,
    letStorePlanTrip: false,
    preferredVehicleId: null,
    placeIds: [],
    source: "DIRECT",
    sessionId: `${PREFIX}DEMO`,
    referrer: null,
  });
  assert("same account across partners", bookingDemo.booking.customerAccountId === accountId);
  assert("bookings tenant isolated", bookingPond.booking.businessId !== bookingDemo.booking.businessId);
  assert("CRM customers tenant scoped", bookingPond.booking.customerId !== bookingDemo.booking.customerId);
  assert("phone normalize", normalizePhone("+66893344556") === "0893344556");

  const content = normalizeExternalContent({
    id: "ext-test-1",
    kind: "REVIEW",
    title: "ตัวอย่างเมตาดาต้า",
    summary: "สรุปสั้น",
    sourceName: "ตัวอย่างแหล่งอ้างอิง",
    sourceUrl: "https://example.com/article",
    sourceType: "BLOG",
  });
  const attr = externalContentAttribution(content);
  assert("attribution label", attr.label.includes("อ้างอิงจาก"));
  assert("attribution CTA", attr.cta === "ดูต้นฉบับ");
  assert("displayable content", isDisplayableExternalContent(content));
  assert(
    "source unavailable not displayable",
    !isDisplayableExternalContent({ ...content, status: "SOURCE_UNAVAILABLE" }),
  );
  } finally {
    await purgeByClientRequestPrefix(PREFIX);
    await purgeCustomerAuthFixtures(PHONE_PREFIX);
  }

  if (failed) {
    console.error(`\nidentity-consolidation-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nidentity-consolidation-check: ALL PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
