/**
 * Customer auth presentation context — PLATFORM vs PARTNER.
 * Same central identity; branding must not fall back to POND from last-store.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  partnerLoginHref,
  platformLoginHref,
  resolveCustomerAuthPresentation,
  sanitizeCustomerReturnTo,
} from "../src/lib/auth/customer-auth-context";
import { STORE_CONTEXT_COOKIE } from "../src/lib/auth/store-context";
import { LocalStore, purgeByClientRequestPrefix, purgeCustomerAuthFixtures } from "../src/lib/data/local-store";
import { PILOT_DEV_OTP } from "../src/lib/auth/otp";

const root = join(__dirname, "..");
let failed = 0;
const PREFIX = "TEST_AUTHCTX_";
const PHONE = "0894455667";
const PHONE_PREFIX = "08944";

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
  const loginPage = read("src/app/account/login/page.tsx");
  const forms = read("src/components/account/CustomerAuthForms.tsx");
  const landing = read("src/components/marketing/KubHaiLanding.tsx");
  const wizard = read("src/components/storefront/BookingWizard.tsx");
  const layout = read("src/app/account/layout.tsx");
  const ctx = read("src/lib/auth/customer-auth-context.ts");

  assert("login uses resolveCustomerAuthPresentation", loginPage.includes("resolveCustomerAuthPresentation"));
  assert("login does not fallback pondcarrent", !loginPage.includes('"pondcarrent"') && !loginPage.includes("'pondcarrent'"));
  assert("login does not use getStoreContextSlug", !loginPage.includes("getStoreContextSlug"));
  assert("layout does not fallback pondcarrent", !layout.includes("pondcarrent"));
  assert("layout does not use getStoreContextSlug", !layout.includes("getStoreContextSlug"));
  assert("landing uses platformLoginHref", landing.includes("platformLoginHref"));
  // Pilot: guest booking — wizard must not force / redirect to customer login
  assert("wizard does not force partnerLoginHref", !wizard.includes("partnerLoginHref"));
  assert("wizard does not embed BookingAuthSheet", !wizard.includes("BookingAuthSheet"));
  assert("auth link helpers remain for legacy account routes", partnerLoginHref("pondcarrent").includes("store=pondcarrent"));
  assert("forms use presentation context", forms.includes("presentation.loginSubtitle") || forms.includes("presentation.kind"));
  assert("never silent POND fallback documented", ctx.includes("Never resolve platform") || ctx.includes("never POND"));
  assert("store context cookie still exists for storefront remember", STORE_CONTEXT_COOKIE === "kh_store_context");

  assert("sanitize blocks //", sanitizeCustomerReturnTo("//evil.com", "/") === "/");
  assert("sanitize blocks store admin", sanitizeCustomerReturnTo("/store", "/") === "/");
  assert("sanitize allows /s/slug", sanitizeCustomerReturnTo("/s/pondcarrent", "/") === "/s/pondcarrent");
  assert("sanitize allows /account", sanitizeCustomerReturnTo("/account", "/") === "/account");
  assert("platformLoginHref sets context", platformLoginHref().includes("context=platform"));
  assert("partnerLoginHref sets store", partnerLoginHref("pondcarrent").includes("store=pondcarrent"));

  // Even with conceptual last-store = POND, platform resolve must be KubHai
  const platform = await resolveCustomerAuthPresentation({
    context: "platform",
    next: "/",
  });
  assert("platform kind", platform.kind === "PLATFORM");
  assert("platform display KubHai", platform.displayName === "KubHai");
  assert("platform subtitle not POND", !platform.loginSubtitle.includes("POND"));
  assert("platform back label", platform.backLabel.includes("ขับให้"));
  assert("platform return /", platform.returnTo === "/");
  assert("platform no partner brand", platform.partnerBrand === null);

  const platformNoParams = await resolveCustomerAuthPresentation({});
  assert("empty params → platform", platformNoParams.kind === "PLATFORM");

  const pond = await resolveCustomerAuthPresentation({
    storeSlug: "pondcarrent",
    next: "/s/pondcarrent",
  });
  assert("pond kind PARTNER", pond.kind === "PARTNER");
  assert("pond name", pond.displayName.includes("POND"));
  assert(
    "pond subtitle is partner booking login",
    pond.loginSubtitle.includes("การจอง") || pond.loginSubtitle.includes("POND"),
  );
  assert("pond poweredBy off for customer", pond.poweredByKubHaiEnabled === false);
  assert("pond back กลับหน้าร้าน", pond.backLabel === "กลับหน้าร้าน");
  assert("pond return storefront", pond.returnTo === "/s/pondcarrent");
  assert("pond brand slug", pond.partnerBrand?.slug === "pondcarrent");

  const demo = await resolveCustomerAuthPresentation({
    storeSlug: "demo-store-002",
    next: "/s/demo-store-002",
  });
  assert("demo002 kind PARTNER", demo.kind === "PARTNER");
  assert("demo002 not POND brand", demo.partnerBrand?.slug === "demo-store-002");
  assert("demo002 primary differs from pond", demo.partnerBrand?.primaryColor !== pond.partnerBrand?.primaryColor);

  const invalidStore = await resolveCustomerAuthPresentation({
    storeSlug: "no-such-store-zzz",
    next: "/",
  });
  assert("invalid store → platform not POND", invalidStore.kind === "PLATFORM");

  // Identity continuity
  const store = new LocalStore();
  await purgeByClientRequestPrefix(PREFIX);
  await purgeCustomerAuthFixtures(PHONE_PREFIX);
  try {
    const start = await store.startCustomerSignup(PHONE);
    const account = await store.completeCustomerSignup({
      challengeId: start.challengeId,
      code: (start as { devCode?: string }).devCode || PILOT_DEV_OTP,
      password: "TestPass123!",
      displayName: `${PREFIX}User`,
    });
    assert("signup from platform path creates account", Boolean(account.id));

    const booking = await store.createBookingRequest({
      businessSlug: "pondcarrent",
      clientRequestId: `${PREFIX}POND`,
      customerName: `${PREFIX}User`,
      customerPhone: PHONE,
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
      pickupLocation: "A",
      dropoffLocation: "B",
      tripNotes: null,
      letStorePlanTrip: false,
      preferredVehicleId: null,
      placeIds: [],
      source: "DIRECT",
      sessionId: `${PREFIX}POND`,
      referrer: null,
    });
    assert("same identity on POND booking", booking.booking.customerAccountId === account.id);

    const booking2 = await store.createBookingRequest({
      businessSlug: "demo-store-002",
      clientRequestId: `${PREFIX}DEMO`,
      customerName: `${PREFIX}User`,
      customerPhone: PHONE,
      customerEmail: null,
      customerType: "PERSONAL",
      companyName: null,
      taxId: null,
      serviceType: "PRIVATE_DRIVER_DAILY",
      startDate: "2026-12-02",
      startTime: "09:00",
      endDate: "2026-12-02",
      endTime: "17:00",
      passengerCount: 2,
      luggageCount: 1,
      pickupLocation: "A",
      dropoffLocation: "B",
      tripNotes: null,
      letStorePlanTrip: false,
      preferredVehicleId: null,
      placeIds: [],
      source: "DIRECT",
      sessionId: `${PREFIX}DEMO`,
      referrer: null,
    });
    assert("same identity on Store #002 booking", booking2.booking.customerAccountId === account.id);
  } finally {
    await purgeByClientRequestPrefix(PREFIX);
    await purgeCustomerAuthFixtures(PHONE_PREFIX);
  }

  // Draft survival: partner login URL preserves next=/s/slug (sessionStorage draft is client-side)
  assert(
    "partner login preserves storefront return",
    partnerLoginHref("pondcarrent", "/s/pondcarrent").includes("next=") &&
      partnerLoginHref("pondcarrent", "/s/pondcarrent").includes("pondcarrent"),
  );

  // Customer cannot use store admin via auth presentation helpers
  assert("platform return never /store", sanitizeCustomerReturnTo("/store/inbox", "/account") === "/account");

  if (failed) {
    console.error(`\nauth-context-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nauth-context-check: ALL PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
