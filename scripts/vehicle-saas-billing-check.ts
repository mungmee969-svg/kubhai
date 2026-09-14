/**
 * Vehicle multi-image + SaaS plan catalog / POND PRO billing foundation.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  LocalStore,
  purgeByClientRequestPrefix,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import {
  hasBookingCapability,
  normalizeSubscriptionPlan,
  planResourceLimits,
  planUnlockHref,
} from "../src/lib/domain/booking-entitlements";
import {
  PUBLIC_SAAS_PLANS,
  catalogEntryForSubscription,
  resolveKubHaiSaasPaymentConfig,
  SAAS_PLAN_CHANGE_NOTICE_TH,
  listSaasPlanAnnouncements,
} from "../src/lib/domain/saas-plans";
import {
  resolveVehicleCoverUrl,
  resolveVehicleGallery,
} from "../src/lib/domain/vehicle-image";
import { BOOKING_WIZARD_MAX_STEP } from "../src/lib/booking/draft";
import type { Actor } from "../src/lib/domain/types";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_VEHICLE_SAAS_";

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

    // —— Plans catalog ——
    assert("3 public plans", PUBLIC_SAAS_PLANS.length === 3);
    assert("Starter 599", PUBLIC_SAAS_PLANS.find((p) => p.id === "starter")?.priceMonthlyThb === 599);
    assert("Pro 999", PUBLIC_SAAS_PLANS.find((p) => p.id === "pro")?.priceMonthlyThb === 999);
    assert("Business 1599", PUBLIC_SAAS_PLANS.find((p) => p.id === "business")?.priceMonthlyThb === 1599);
    assert("Pro is middle price", PUBLIC_SAAS_PLANS[1].id === "pro");

    const pond = await store.getPublicStore("pondcarrent");
    assert("POND exists", pond?.business.slug === "pondcarrent");
    assert("POND subscriptionPlan raw pro", pond!.business.subscriptionPlan === "pro");
    assert("POND normalizes to pro", normalizeSubscriptionPlan(pond!.business.subscriptionPlan) === "pro");
    assert("POND catalog card Pro", catalogEntryForSubscription(pond!.business.subscriptionPlan).id === "pro");
    assert(
      "POND Pro price 999",
      catalogEntryForSubscription(pond!.business.subscriptionPlan).priceMonthlyThb === 999,
    );
    assert("POND has Pro hero entitlement", hasBookingCapability(pond!.business.subscriptionPlan, "booking.customHero"));
    assert("POND has Pro theme entitlement", hasBookingCapability(pond!.business.subscriptionPlan, "booking.customTheme"));
    assert(
      "POND lacks Business layout unless upgraded",
      !hasBookingCapability(pond!.business.subscriptionPlan, "booking.customLayout"),
    );

    // No store-slug hardcode for features
    const entitlementsSrc = readFileSync(
      path.join(process.cwd(), "src/lib/domain/booking-entitlements.ts"),
      "utf8",
    );
    const saasSrc = readFileSync(path.join(process.cwd(), "src/lib/domain/saas-plans.ts"), "utf8");
    assert("no pondcarrent in entitlements", !entitlementsSrc.includes("pondcarrent"));
    assert("no pondcarrent in saas-plans", !saasSrc.includes("pondcarrent"));
    assert("plan unlock → billing", planUnlockHref() === "/store/billing");

    // Future PRO store resolves identically
    assert("any pro gets hero", hasBookingCapability("pro", "booking.customHero"));
    assert("starter does not get hero", !hasBookingCapability("starter", "booking.customHero"));

    // —— Fleet caps: only advertise what product finalized ——
    assert("starter fleet cap 3", planResourceLimits("starter").maxVehicles === 3);
    assert("starter driver cap unset", planResourceLimits("starter").maxDrivers === null);
    assert("pro fleet cap 10", planResourceLimits("pro").maxVehicles === 10);
    assert("pro driver cap 10", planResourceLimits("pro").maxDrivers === 10);
    assert(
      "business caps unset — never invented",
      planResourceLimits("business").maxVehicles === null &&
        planResourceLimits("business").maxDrivers === null,
    );
    const starterCard = PUBLIC_SAAS_PLANS.find((p) => p.id === "starter")!;
    const businessCard = PUBLIC_SAAS_PLANS.find((p) => p.id === "business")!;
    assert(
      "starter card states fleet cap",
      starterCard.highlights.some((line) => line.includes("3")),
    );
    assert(
      "business card claims no unlimited fleet",
      businessCard.highlights.every(
        (line) => Boolean(line.trim()) && !line.includes("ไม่จำกัด"),
      ),
    );
    assert(
      "starter card no longer promises own-brand storefront",
      starterCard.highlights.some((line) => line.includes("KubHai")),
    );

    // SaaS payment — no fabrication
    const pay = resolveKubHaiSaasPaymentConfig();
    assert("unconfigured SaaS pay when env empty", pay.configured === false || Boolean(process.env.KUBHAI_SAAS_PROMPTPAY_ID));
    if (!process.env.KUBHAI_SAAS_PROMPTPAY_ID && !process.env.KUBHAI_SAAS_BANK_ACCOUNT_NUMBER) {
      assert("no fake PromptPay", pay.promptPayId === null);
      assert("no fake bank", pay.bankAccountNumber === null);
    }
    assert("no fabricated announcements", listSaasPlanAnnouncements().length === 0);
    assert("plan change notice present", SAAS_PLAN_CHANGE_NOTICE_TH.includes("อาจมีการปรับเปลี่ยน"));

    const billingPage = readFileSync(path.join(process.cwd(), "src/app/store/billing/page.tsx"), "utf8");
    assert("billing page exists", billingPage.includes("แพ็กเกจและการชำระเงิน"));
    assert("billing separates customer money", billingPage.includes("แยกจากเงินที่ลูกค้าจ่าย"));
    assert("no fake next billing date invented", !billingPage.includes("รอบบิลถัดไป") || billingPage.includes("authoritative"));
    const nav = readFileSync(path.join(process.cwd(), "src/components/store-admin/shell/nav.ts"), "utf8");
    assert("nav has billing", nav.includes("/store/billing") && nav.includes("แพ็กเกจและการชำระเงิน"));

    // —— Vehicles multi-image ——
    const multi = await store.upsertVehicle(pondOwner, SEED.businessPond, {
      ownershipType: "OWN",
      vehicleType: "VAN",
      brand: "TEST",
      model: "Gallery Multi",
      year: 2024,
      color: "ขาว",
      plateNumber: "TEST-IMG-01",
      seats: 9,
      luggageCapacity: 5,
      description: "fixture multi-image",
      amenities: ["แอร์"],
      basePrice: 1000,
      pricingUnit: "วัน",
      imageUrls: ["/fleet/van.jpg", "/fleet/suv.jpg", "/fleet/car.jpg"],
      coverImageUrl: "/fleet/suv.jpg",
      status: "ACTIVE",
      active: true,
    });
    assert("cover persisted", multi.coverImageUrl === "/fleet/suv.jpg");
    assert("gallery order persisted", multi.imageUrls.join(",") === "/fleet/van.jpg,/fleet/suv.jpg,/fleet/car.jpg");
    assert("resolve cover uses cover field", resolveVehicleCoverUrl(multi) === "/fleet/suv.jpg");
    assert("resolve gallery length 3", resolveVehicleGallery(multi).length === 3);
    assert("gallery starts with cover", resolveVehicleGallery(multi)[0] === "/fleet/suv.jpg");

    const reordered = await store.upsertVehicle(pondOwner, SEED.businessPond, {
      id: multi.id,
      ownershipType: multi.ownershipType,
      vehicleType: multi.vehicleType,
      brand: multi.brand,
      model: multi.model,
      year: multi.year,
      color: multi.color,
      plateNumber: multi.plateNumber,
      seats: multi.seats,
      luggageCapacity: multi.luggageCapacity,
      description: multi.description,
      amenities: multi.amenities,
      basePrice: multi.basePrice,
      pricingUnit: multi.pricingUnit,
      imageUrls: ["/fleet/car.jpg", "/fleet/van.jpg"],
      coverImageUrl: "/fleet/car.jpg",
      status: "ACTIVE",
      active: true,
    });
    assert("reorder + remove persisted", reordered.imageUrls.length === 2 && reordered.coverImageUrl === "/fleet/car.jpg");

    // Tenant isolation: demo owner cannot update POND vehicle
    const demoOwner: Actor = {
      kind: "user",
      userId: SEED.userDemo002,
      role: "BUSINESS_OWNER",
      businessIds: [SEED.businessDemo002],
    };
    let isolated = false;
    try {
      await store.upsertVehicle(demoOwner, SEED.businessPond, {
        id: multi.id,
        ownershipType: "OWN",
        vehicleType: "VAN",
        brand: "HACK",
        model: "Nope",
        year: null,
        color: null,
        plateNumber: null,
        seats: 4,
        luggageCapacity: 2,
        description: null,
        amenities: [],
        basePrice: null,
        pricingUnit: "วัน",
        imageUrls: ["/fleet/car.jpg"],
        coverImageUrl: "/fleet/car.jpg",
        status: "ACTIVE",
        active: true,
      });
    } catch {
      isolated = true;
    }
    assert("cross-tenant vehicle write blocked", isolated);

    // —— Starter fleet cap enforced server-side (demo store is on the starter tier) ——
    const demoStore = await store.getPublicStore("demo-store-002");
    assert(
      "demo store normalizes to starter",
      normalizeSubscriptionPlan(demoStore!.business.subscriptionPlan) === "starter",
    );
    const starterCap = planResourceLimits(demoStore!.business.subscriptionPlan).maxVehicles!;
    const capFixtures: string[] = [];
    let capRejected = false;
    for (let index = 0; index < starterCap + 1; index += 1) {
      try {
        const created = await store.upsertVehicle(demoOwner, SEED.businessDemo002, {
          ownershipType: "OWN",
          vehicleType: "SEDAN",
          brand: "TEST",
          model: `Cap ${index}`,
          year: null,
          color: null,
          plateNumber: `TEST-CAP-${index}`,
          seats: 4,
          luggageCapacity: 2,
          description: null,
          amenities: [],
          basePrice: null,
          pricingUnit: "วัน",
          imageUrls: [],
          coverImageUrl: null,
          status: "ACTIVE",
          active: true,
        });
        capFixtures.push(created.id);
      } catch {
        capRejected = index === starterCap;
      }
    }
    assert(`starter blocked at ${starterCap} active vehicles`, capRejected);
    assert("starter allowed exactly the cap", capFixtures.length === starterCap);
    for (const id of capFixtures) {
      await store.setVehicleActive(demoOwner, id, false);
    }

    const pub = await store.getPublicStore("pondcarrent");
    const pubVehicle = pub!.vehicles.find((v) => v.id === multi.id);
    assert("public vehicle has cover", pubVehicle?.coverImageUrl === "/fleet/car.jpg");
    assert("public hides plate", pubVehicle?.plateNumber == null);

    // Gallery UI is overlay — not a 6th card
    assert("Quick Booking still 5 cards", BOOKING_WIZARD_MAX_STEP === 5);
    const wizard = readFileSync(
      path.join(process.cwd(), "src/components/storefront/BookingWizard.tsx"),
      "utf8",
    );
    assert("wizard has gallery sheet", wizard.includes("VehicleGallerySheet"));
    // Wizard copy is localized — assert the key, not the Thai string.
    assert("view-photos CTA present", wizard.includes("booking.viewPhotos"));

    // Cleanup fixture vehicle
    await store.setVehicleActive(pondOwner, multi.id, false);

    await purgeByClientRequestPrefix(PREFIX);
  } catch (error) {
    failed += 1;
    console.error("FAIL  unexpected", error);
    try {
      await purgeByClientRequestPrefix(PREFIX);
    } catch {
      /* ignore */
    }
  }

  if (failed) {
    console.error(`\nvehicle-saas-billing-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nvehicle-saas-billing-check: all passed");
}

main();
