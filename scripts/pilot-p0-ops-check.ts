/**
 * Pilot P0 checks: guest booking, payment success states, plan branding, driver job tokens.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { LocalStore, purgeByClientRequestPrefix } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { BOOKING_WIZARD_MAX_STEP } from "../src/lib/booking/draft";
import { resolveBusinessBranding } from "../src/lib/domain/branding";
import { normalizeSubscriptionPlan } from "../src/lib/domain/booking-entitlements";
import { driverJobPath, resolveDayWorkStatus } from "../src/lib/domain/driver-job";
import { deriveNotifications } from "../src/lib/domain/ops";
import type { Actor, PaymentProof } from "../src/lib/domain/types";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_PILOT_P0_";

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

    const wizard = readFileSync(
      path.join(process.cwd(), "src/components/storefront/BookingWizard.tsx"),
      "utf8",
    );
    assert("wizard has no BookingAuthSheet", !wizard.includes("BookingAuthSheet"));
    assert("wizard has no partnerLoginHref", !wizard.includes("partnerLoginHref"));
    assert("submit has no sessionReady gate", !wizard.includes("sessionReady"));
    assert("Quick Booking still 5 cards", BOOKING_WIZARD_MAX_STEP === 5);

    const chrome = readFileSync(
      path.join(process.cwd(), "src/components/storefront/BookingWizardChrome.tsx"),
      "utf8",
    );
    assert("chrome has no เข้าสู่ระบบ", !chrome.includes("เข้าสู่ระบบ"));

    const nav = readFileSync(
      path.join(process.cwd(), "src/components/storefront/PartnerCustomerNav.tsx"),
      "utf8",
    );
    assert(
      "partner nav has My Bookings via partnerLoginHref",
      nav.includes("partnerLoginHref") && nav.includes("nav.myBookings"),
    );
    assert("partner nav bookings path", nav.includes("/bookings"));
    assert("partner nav has no hardcoded KubHai login", !nav.includes("platformLoginHref"));

    const bookingPage = readFileSync(
      path.join(process.cwd(), "src/app/booking/[token]/page.tsx"),
      "utf8",
    );
    // The banner is required now: a guest booking is reachable by token only, so
    // without a claim entry point it never reaches «my bookings».
    assert("token page offers account claim", bookingPage.includes("BookingAccountBanner"));
    assert(
      "token page claim stays partner-scoped",
      bookingPage.includes("storeSlug={business.slug}"),
    );
    assert("token page uses StoreBrandScope", bookingPage.includes("StoreBrandScope"));

    const accountBanner = readFileSync(
      path.join(process.cwd(), "src/components/booking/BookingAccountBanner.tsx"),
      "utf8",
    );
    assert("banner copy is not KubHai-branded", !accountBanner.includes("บัญชี KubHai"));
    assert("banner never claims by phone alone", accountBanner.includes("claimBookingTokenAction"));

    const created = await store.createBookingRequest({
      businessSlug: "pondcarrent",
      clientRequestId: `${PREFIX}GUEST`,
      customerName: "ลูกค้าเกสต์",
      customerPhone: "0899111222",
      customerEmail: null,
      customerType: "PERSONAL",
      companyName: null,
      taxId: null,
      serviceType: "PRIVATE_DRIVER_DAILY",
      startDate: "2026-12-10",
      startTime: "09:00",
      endDate: "2026-12-10",
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
      sessionId: `${PREFIX}GUEST`,
      referrer: null,
    });
    assert("guest booking created", Boolean(created.booking.securePublicToken));
    assert("guest booking has no required account", created.booking.customerAccountId == null);

    const pond = await store.getPublicStore("pondcarrent");
    const demo = await store.getPublicStore("demo-store-002");
    const pondBrand = resolveBusinessBranding(pond!.business);
    const demoBrand = resolveBusinessBranding(demo!.business);
    assert("POND brand resolves", pondBrand.slug === "pondcarrent");
    assert("demo brand not POND slug", demoBrand.slug === "demo-store-002");
    assert("brands differ", pondBrand.primaryColor !== demoBrand.primaryColor);
    assert("POND still PRO", normalizeSubscriptionPlan(pond!.business.subscriptionPlan) === "pro");

    const paymentUi = readFileSync(
      path.join(process.cwd(), "src/components/booking/CustomerPaymentProof.tsx"),
      "utf8",
    );
    assert("payment has จองสำเร็จ", paymentUi.includes("จองสำเร็จ"));
    assert("payment checks APPROVED deposit", paymentUi.includes('reviewStatus === "APPROVED"'));

    const now = new Date().toISOString();
    const fakeProof = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      businessId: SEED.businessPond,
      bookingId: created.booking.id,
      paymentIntent: "DEPOSIT",
      claimedAmount: 1000,
      receivingAccountId: null,
      receivingAccountSnapshot: null,
      slipFileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      submittedAt: now,
      submittedBy: "CUSTOMER",
      submittedByUserId: null,
      reviewStatus: "PENDING_REVIEW",
      reviewedBy: null,
      reviewedAt: null,
      rejectReason: null,
      adminNote: null,
      allocations: [],
      moneyMovementId: null,
      createdAt: now,
      updatedAt: now,
    } satisfies PaymentProof;

    const notifications = deriveNotifications({
      bookings: [created.booking],
      proofs: [fakeProof],
    });
    assert("notification for new booking", notifications.some((item) => item.id.startsWith("req-")));
    assert("notification for pending proof", notifications.some((item) => item.title.includes("สลิป")));

    const { bookingWorkloadBadgeCount, notificationBadgeCounts } = await import(
      "../src/lib/domain/ops"
    );
    const notifBadges = notificationBadgeCounts(notifications);
    assert("multiple notification events for one booking", notifications.length >= 2);
    assert(
      "workload badge is unique bookings",
      bookingWorkloadBadgeCount([created.booking], [created.booking.id]) === 1,
    );
    assert(
      "bell total is event count",
      notifBadges.total === notifications.filter((item) => !item.read).length,
    );

    // A: assign before deposit → NO DriverJobLink
    await store.assignBooking(pondOwner, created.booking.id, {
      vehicleId: SEED.vehicleVan,
      driverId: SEED.driverInternal,
    });
    const prePayJob = await store.listDriverJobForBooking(pondOwner, created.booking.id);
    assert("no driver link before deposit approval", prePayJob.link == null);

    // Progress to confirmed via status path used by fixtures (deposit confirmed)
    for (const status of [
      "CHECKING_AVAILABILITY",
      "AVAILABLE",
      "QUOTATION_SENT",
      "CUSTOMER_CONFIRMED",
      "WAITING_DEPOSIT",
      "CONFIRMED",
    ] as const) {
      await store.updateBookingStatus(pondOwner, created.booking.id, status);
    }

    // B: after confirmed + driver assigned → exactly one link
    const job = await store.listDriverJobForBooking(pondOwner, created.booking.id);
    assert("driver job link issued after confirm", Boolean(job.link?.secureToken));
    assert(
      "driver job path",
      job.link ? driverJobPath(job.link.secureToken).startsWith("/driver/job/") : false,
    );

    // C: idempotent — re-assign same driver keeps same token
    const tokenBefore = job.link!.secureToken;
    await store.assignBooking(pondOwner, created.booking.id, {
      vehicleId: SEED.vehicleVan,
      driverId: SEED.driverInternal,
    });
    const jobSame = await store.listDriverJobForBooking(pondOwner, created.booking.id);
    assert("idempotent same-driver link", jobSame.link?.secureToken === tokenBefore);

    const byToken = await store.getDriverJobByToken(tokenBefore);
    assert("valid token opens job", byToken?.booking.id === created.booking.id);
    assert(
      "invalid token rejected",
      (await store.getDriverJobByToken("not-a-real-token-xxxxxxxxxxxx")) == null,
    );

    // D: reassign → revoke old, issue new
    const oldToken = tokenBefore;
    await store.assignBooking(pondOwner, created.booking.id, {
      vehicleId: SEED.vehicleVan,
      driverId: SEED.driverPartner,
    });
    assert("old token revoked", (await store.getDriverJobByToken(oldToken)) == null);
    const job2 = await store.listDriverJobForBooking(pondOwner, created.booking.id);
    assert(
      "new token active",
      Boolean(job2.link?.secureToken) && job2.link!.secureToken !== oldToken,
    );

    const token = job2.link!.secureToken;
    const startedRec = await store.startDriverDay(token, 1);
    const startedLog = startedRec.dayLogs.find((item) => item.dayNumber === 1)!;
    assert("day started", resolveDayWorkStatus(startedLog) === "ACTIVE" && Boolean(startedLog.startedAt));
    let dupStart = false;
    try {
      await store.startDriverDay(token, 1);
    } catch {
      dupStart = true;
    }
    assert("duplicate start blocked", dupStart);
    const endedRec = await store.endDriverDay(token, 1);
    const endedLog = endedRec.dayLogs.find((item) => item.dayNumber === 1)!;
    assert(
      "day ended",
      resolveDayWorkStatus(endedLog) === "DAY_COMPLETED" && Boolean(endedLog.endedAt),
    );
    assert("elapsed calculated", typeof endedLog.elapsedMinutes === "number");

    const beforeItin = (await store.getDriverJobByToken(token))!.itinerary.length;
    await store.submitDriverSuggestion(token, { body: "รถติด แนะนำสลับจุด", dayNumber: 1 });
    const after = await store.getDriverJobByToken(token);
    assert("suggestion stored", after!.suggestions.length >= 1);
    assert("itinerary unchanged by suggestion", after!.itinerary.length === beforeItin);

    // E: cancel → link invalid
    await store.updateBookingStatus(pondOwner, created.booking.id, "CANCELLED", {
      reason: "ทดสอบยกเลิกหลังยืนยัน",
    });
    assert("cancel revokes driver link", (await store.getDriverJobByToken(token)) == null);

    const offerSrc = readFileSync(
      path.join(process.cwd(), "src/components/store-admin/booking/StoreOfferForm.tsx"),
      "utf8",
    );
    assert("quotation primary CTA send", offerSrc.includes("ส่งข้อเสนอให้ลูกค้า"));
    assert("quotation has preview secondary", offerSrc.includes("ดูตัวอย่างข้อเสนอ"));
    assert("no normal draft save button", !offerSrc.includes("บันทึกร่าง"));

    const storeLogin = readFileSync(path.join(process.cwd(), "src/app/store/login/page.tsx"), "utf8");
    assert("store login page exists", storeLogin.length > 50);

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
    console.error(`\npilot-p0-ops-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\npilot-p0-ops-check: all passed");
}

main();
