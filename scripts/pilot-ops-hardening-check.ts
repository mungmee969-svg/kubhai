/**
 * Pilot operations hardening — badge, driver link gate, inbox, quote UX, dispatch list.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { LocalStore, purgeByClientRequestPrefix } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { BOOKING_WIZARD_MAX_STEP } from "../src/lib/booking/draft";
import {
  OPS_INBOX_FILTERS,
  matchesOpsInboxFilter,
} from "../src/lib/domain/booking-ops-next";
import {
  isDriverJobLinkEligible,
} from "../src/lib/domain/driver-job";
import {
  bookingsInDispatchRange,
  isOperationalDispatchBooking,
  resolveOpsJobStatus,
} from "../src/lib/domain/dispatch-ops";
import {
  bookingWorkloadBadgeCount,
  deriveNotifications,
  notificationBadgeCounts,
} from "../src/lib/domain/ops";
import { settleBooking } from "../src/lib/domain/settlement";
import { allocationsFromIntent } from "../src/lib/domain/payment-accounts";
import type { Actor, Booking } from "../src/lib/domain/types";

const store = new LocalStore();
const PREFIX = "TEST_OPS_HARD_";
let failed = 0;

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

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function tokenActor(booking: Booking): Actor {
  return { kind: "booking_token", token: booking.securePublicToken };
}

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);

    assert("Quick Booking still 5 cards", BOOKING_WIZARD_MAX_STEP === 5);

    const inboxLabels = OPS_INBOX_FILTERS.map((item) => item.label);
    assert(
      "inbox labels simplified",
      inboxLabels.includes("รายการใหม่") &&
        inboxLabels.includes("ดำเนินการ") &&
        inboxLabels.includes("ตรวจสอบ") &&
        inboxLabels.includes("ยืนยันแล้ว") &&
        inboxLabels.includes("ทั้งหมด"),
    );

    const offerSrc = readFileSync(
      path.join(process.cwd(), "src/components/store-admin/booking/StoreOfferForm.tsx"),
      "utf8",
    );
    assert("quote primary send CTA", offerSrc.includes('ส่งข้อเสนอให้ลูกค้า'));
    assert("quote secondary preview", offerSrc.includes("ดูตัวอย่างข้อเสนอ"));
    assert("no บันทึกร่าง in offer UI", !offerSrc.includes("บันทึกร่าง"));
    assert("no red ยกเลิก beside send", !offerSrc.includes(">ยกเลิก<") && !offerSrc.includes("ยกเลิกใบเสนอราคา"));

    const paySrc = readFileSync(
      path.join(process.cwd(), "src/components/store-admin/booking/PaymentReview.tsx"),
      "utf8",
    );
    assert("payment review has อนุมัติ", paySrc.includes("อนุมัติ"));
    assert("payment review has ปฏิเสธ", paySrc.includes("ปฏิเสธ"));

    const dispatchSrc = readFileSync(
      path.join(process.cwd(), "src/components/store-admin/fleet/DispatchBoard.tsx"),
      "utf8",
    );
    assert("dispatch hosts job list", dispatchSrc.includes("DispatchOpsJobList"));
    assert("dispatch list section exists", readFileSync(
      path.join(process.cwd(), "src/components/store-admin/fleet/DispatchOpsJobList.tsx"),
      "utf8",
    ).includes("รายการงาน"));

    const timeSrc = readFileSync(
      path.join(process.cwd(), "src/components/storefront/BookingTimeField.tsx"),
      "utf8",
    );
    assert("BookingTimeField sheet picker", timeSrc.includes("เลือกเวลา") || timeSrc.includes("เวลา"));

    const created = await store.createBookingRequest({
      businessSlug: "pondcarrent",
      clientRequestId: `${PREFIX}FLOW`,
      customerName: "ลูกค้า hardening",
      customerPhone: "0899333444",
      customerEmail: null,
      customerType: "PERSONAL",
      companyName: null,
      taxId: null,
      serviceType: "PRIVATE_DRIVER_DAILY",
      startDate: "2026-12-18",
      startTime: "10:30",
      endDate: "2026-12-18",
      endTime: "17:00",
      passengerCount: 2,
      luggageCount: 1,
      pickupLocation: "CNX",
      dropoffLocation: "นิมมาน",
      tripNotes: null,
      letStorePlanTrip: false,
      preferredVehicleId: null,
      placeIds: [],
      source: "DIRECT",
      sessionId: `${PREFIX}FLOW`,
      referrer: null,
    });
    assert("selected time reaches store booking", created.booking.startTime === "10:30");

    assert(
      "NEW inbox",
      matchesOpsInboxFilter(created.booking, settleBooking(created.booking, []), "NEW"),
    );

    // Assign before pay — no link
    await store.assignBooking(pondOwner, created.booking.id, {
      vehicleId: SEED.vehicleVan,
      driverId: SEED.driverInternal,
    });
    assert(
      "not eligible before deposit",
      !isDriverJobLinkEligible(created.booking, [], created.booking.id),
    );
    assert(
      "no link pre-deposit",
      (await store.listDriverJobForBooking(pondOwner, created.booking.id)).link == null,
    );

    await store.updateBookingStatus(pondOwner, created.booking.id, "CHECKING_AVAILABILITY");
    await store.updateBookingStatus(pondOwner, created.booking.id, "AVAILABLE");
    const draft = await store.createQuotationDraft(pondOwner, created.booking.id);
    await store.updateQuotationDraft(pondOwner, draft.id, {
      items: [{ type: "VEHICLE_SERVICE", description: "ค่าบริการ", quantity: 1, unitPrice: 5000 }],
      discountAmount: 0,
      depositType: "FIXED_AMOUNT",
      depositValue: 1500,
      terms: null,
      includedHoursPerDay: 8,
      overtimeRatePerHour: 200,
      note: null,
    });
    const sent = await store.sendQuotation(pondOwner, draft.id);
    await store.acceptQuotation(tokenActor(created.booking), sent.id);

    const waiting = await store.getBookingById(pondOwner, created.booking.id);
    assert("waiting deposit", waiting?.booking.status === "WAITING_DEPOSIT");
    assert(
      "still no link while waiting deposit",
      (await store.listDriverJobForBooking(pondOwner, created.booking.id)).link == null,
    );

    const actor = tokenActor(waiting!.booking);
    const slip = await store.writeSlipFile(actor, {
      bookingId: waiting!.booking.id,
      bytes: PNG,
      mime: "image/png",
      originalName: "deposit.png",
    });
    const proof = await store.submitPaymentProof(actor, {
      bookingId: waiting!.booking.id,
      paymentIntent: "DEPOSIT",
      claimedAmount: 1500,
      allocations: allocationsFromIntent("DEPOSIT", 1500),
      slipFileId: slip.id,
      submittedBy: "CUSTOMER",
    });

    assert(
      "REVIEW inbox with pending proof",
      matchesOpsInboxFilter(waiting!.booking, settleBooking(waiting!.booking, []), "REVIEW", {
        pendingProof: true,
      }),
    );

    const notifs = deriveNotifications({
      bookings: [waiting!.booking],
      proofs: [proof],
      quotations: waiting!.quotations,
    });
    const eventBadges = notificationBadgeCounts(notifs);
    const workload = bookingWorkloadBadgeCount([waiting!.booking], [waiting!.booking.id]);
    assert("workload badge unique = 1", workload === 1);
    assert(
      "notification event count independent",
      eventBadges.total >= 1,
    );

    await store.approvePaymentProof(pondOwner, proof.id, {
      allocations: allocationsFromIntent("DEPOSIT", 1500),
    });
    const confirmed = await store.getBookingById(pondOwner, created.booking.id);
    assert("confirmed after deposit approve", confirmed?.booking.status === "CONFIRMED");
    assert(
      "CONFIRMED inbox bucket",
      matchesOpsInboxFilter(
        confirmed!.booking,
        settleBooking(confirmed!.booking, confirmed!.movements),
        "CONFIRMED",
      ),
    );
    assert("operational dispatch booking", isOperationalDispatchBooking(confirmed!.booking));
    assert("start time still 10:30", confirmed!.booking.startTime === "10:30");

    const job = await store.listDriverJobForBooking(pondOwner, created.booking.id);
    assert("link issued after approve + driver", Boolean(job.link?.secureToken));
    const token1 = job.link!.secureToken;
    await store.approvePaymentProof(pondOwner, proof.id);
    const jobAgain = await store.listDriverJobForBooking(pondOwner, created.booking.id);
    assert("idempotent after re-approve", jobAgain.link?.secureToken === token1);

    const links = await store.listDriverJobLinks(pondOwner, SEED.businessPond);
    const activeForBooking = links.filter(
      (item) => item.bookingId === created.booking.id && item.status === "ACTIVE",
    );
    assert("exactly one active link", activeForBooking.length === 1);

    assert(
      "ops status wait start",
      resolveOpsJobStatus(confirmed!.booking, []) === "WAIT_START",
    );
    assert(
      "in dispatch range",
      bookingsInDispatchRange([confirmed!.booking], {
        start: "2026-12-18",
        end: "2026-12-18",
      }).length === 1,
    );

    await store.startDriverDay(token1, 1);
    const dayLogs = await store.listDriverDayLogs(pondOwner, SEED.businessPond);
    const running = await store.getBookingById(pondOwner, created.booking.id);
    assert(
      "ops status in progress",
      resolveOpsJobStatus(running!.booking, dayLogs) === "IN_PROGRESS",
    );
    await store.endDriverDay(token1, 1);
    // Operational day done does not imply financially closed
    const afterEnd = await store.getBookingById(pondOwner, created.booking.id);
    assert(
      "not financially closed merely by day end",
      afterEnd!.booking.status !== "COMPLETED" ||
        settleBooking(afterEnd!.booking, afterEnd!.movements).state !== "SETTLED",
    );

    await store.assignBooking(pondOwner, created.booking.id, {
      vehicleId: SEED.vehicleVan,
      driverId: SEED.driverPartner,
    });
    assert("old link revoked on reassign", (await store.getDriverJobByToken(token1)) == null);
    const jobNew = await store.listDriverJobForBooking(pondOwner, created.booking.id);
    assert("new link after reassign", Boolean(jobNew.link?.secureToken));

    const cancelToken = jobNew.link!.secureToken;
    await store.updateBookingStatus(pondOwner, created.booking.id, "CANCELLED", {
      reason: "ลูกค้าเปลี่ยนแผน",
    });
    assert("cancel revokes link", (await store.getDriverJobByToken(cancelToken)) == null);
    const retained = await store.getBookingById(pondOwner, created.booking.id);
    assert("cancel retains booking history", retained?.booking.status === "CANCELLED");
    assert("cancel retains proofs", (retained?.proofs.length ?? 0) >= 1);
    assert("cancel retains quotations", (retained?.quotations.length ?? 0) >= 1);

    // Abandoned unpaid — assign only, never confirm
    const abandoned = await store.createBookingRequest({
      businessSlug: "pondcarrent",
      clientRequestId: `${PREFIX}ABANDON`,
      customerName: "ทิ้งจอง",
      customerPhone: "0899000111",
      customerEmail: null,
      customerType: "PERSONAL",
      companyName: null,
      taxId: null,
      serviceType: "PRIVATE_DRIVER_DAILY",
      startDate: "2026-12-20",
      startTime: "09:00",
      endDate: "2026-12-20",
      endTime: "17:00",
      passengerCount: 1,
      luggageCount: 0,
      pickupLocation: "ทดสอบ",
      dropoffLocation: null,
      tripNotes: null,
      letStorePlanTrip: false,
      preferredVehicleId: null,
      placeIds: [],
      source: "DIRECT",
      sessionId: `${PREFIX}ABANDON`,
      referrer: null,
    });
    await store.assignBooking(pondOwner, abandoned.booking.id, {
      vehicleId: SEED.vehicleVan,
      driverId: SEED.driverInternal,
    });
    assert(
      "abandoned unpaid has no DriverJobLink",
      (await store.listDriverJobForBooking(pondOwner, abandoned.booking.id)).link == null,
    );

    const globals = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    assert("micro-interaction ui-press", globals.includes(".ui-press"));
    assert("reduced-motion respected", globals.includes("prefers-reduced-motion"));

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

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll pilot-ops-hardening checks passed");
}

main();
