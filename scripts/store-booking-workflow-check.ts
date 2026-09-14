/**
 * Store Admin booking workflow check — domain/API coverage for inbox next-action,
 * combined assign, OT terms (no money), quotation send/versioning, customer acceptance
 * authority, deposit/proof, storefront isolation.
 */
import { LocalStore, purgeByClientRequestPrefix } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import {
  buildOpsCardSummary,
  composeOvertimeTerms,
  matchesOpsInboxFilter,
  resolveBookingNextAction,
} from "../src/lib/domain/booking-ops-next";
import { PRIMARY_ACTION } from "../src/lib/domain/status-ui";
import { storefrontPath } from "../src/lib/domain/storefront-url";
import { allocationsFromIntent } from "../src/lib/domain/payment-accounts";
import { settleBooking } from "../src/lib/domain/settlement";
import type { Actor, Booking } from "../src/lib/domain/types";

const store = new LocalStore();
const PREFIX = "TEST_STORE_WF_";
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

const demoOwner: Actor = {
  kind: "user",
  userId: SEED.userDemo002,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessDemo002],
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

    // --- Storefront link isolation ---
    const pondBiz = await store.getPublicStore("pondcarrent");
    const demoBiz = await store.getPublicStore("demo-store-002");
    assert("POND storefront path", storefrontPath(pondBiz!.business.slug) === "/s/pondcarrent");
    assert("Store #002 storefront path", storefrontPath(demoBiz!.business.slug) === "/s/demo-store-002");
    assert(
      "storefront paths differ",
      storefrontPath(pondBiz!.business.slug) !== storefrontPath(demoBiz!.business.slug),
    );

    // --- POND OT defaults (scoped) — ensure seed/pilot defaults without leaking to #002 ---
    await store.updateSettings(pondOwner, SEED.businessPond, {
      ops: {
        ...(pondBiz?.settings?.ops ?? {
          minAdvanceHours: null,
          serviceHours: null,
          cancellationPolicy: null,
          customerInstructions: null,
          overtimeNote: null,
          bankName: null,
          bankAccountName: null,
          bankAccountNumber: null,
          promptpay: null,
          quotationPrefix: null,
          taxInvoiceName: null,
          taxId: null,
        }),
        includedHoursPerDay: 8,
        overtimeRatePerHour: 200,
        overtimeNote: "รวม 8 ชั่วโมง/วัน · OT 200 บาท/ชั่วโมง (คิดตามเวลาใช้งานจริง)",
      },
    });
    if (demoBiz?.settings?.ops) {
      await store.updateSettings(demoOwner, SEED.businessDemo002, {
        ops: {
          ...demoBiz.settings.ops,
          includedHoursPerDay: null,
          overtimeRatePerHour: null,
        },
      });
    }
    const pondAfter = await store.getPublicStore("pondcarrent");
    const demoAfter = await store.getPublicStore("demo-store-002");
    assert("POND default included hours 8", pondAfter?.settings?.ops?.includedHoursPerDay === 8);
    assert("POND default OT rate 200", pondAfter?.settings?.ops?.overtimeRatePerHour === 200);
    assert("Store #002 does not inherit POND OT hours", demoAfter?.settings?.ops?.includedHoursPerDay == null);
    assert("Store #002 does not inherit POND OT rate", demoAfter?.settings?.ops?.overtimeRatePerHour == null);

    // --- Customer acceptance must not be a store primary action ---
    assert(
      "no store CTA impersonating customer accept",
      PRIMARY_ACTION.QUOTATION_SENT == null && PRIMARY_ACTION.AVAILABLE == null,
    );

    // --- New request + card summary + next action ---
    const created = await store.createBookingRequest({
      businessSlug: "pondcarrent",
      clientRequestId: `${PREFIX}NEW`,
      customerName: "ลูกค้า workflow",
      customerPhone: "0812223344",
      customerEmail: null,
      customerType: "PERSONAL",
      companyName: null,
      taxId: null,
      serviceType: "PRIVATE_DRIVER_DAILY",
      startDate: "2026-11-14",
      startTime: "09:00",
      endDate: "2026-11-17",
      endTime: "17:00",
      passengerCount: 2,
      luggageCount: 2,
      pickupLocation: "นิมมานเหมินทร์",
      dropoffLocation: "สนามบินเชียงใหม่ (CNX)",
      tripNotes: null,
      letStorePlanTrip: true,
      preferredVehicleId: null,
      placeIds: [],
      source: "DIRECT",
      sessionId: `${PREFIX}NEW`,
      referrer: null,
    });
    const booking = created.booking;
    const settle0 = settleBooking(booking, []);
    const next0 = resolveBookingNextAction(booking, [], settle0);
    const card = buildOpsCardSummary(booking, { attention: "ยังไม่ได้จัดรถและคนขับ" });
    assert("new request status REQUESTED", booking.status === "REQUESTED");
    assert("next action assign/review", next0.kind === "REVIEW_AND_ASSIGN" && next0.ctaLabel === "จัดรถและคนขับ");
    assert("inbox NEW filter", matchesOpsInboxFilter(booking, settle0, "NEW"));
    assert(
      "inbox ACTION false for brand-new REQUESTED",
      !matchesOpsInboxFilter(booking, settle0, "ACTION", { quotations: [] }),
    );
    assert("card who", card.statusLabel === "คำขอใหม่" && booking.customerNameSnapshot === "ลูกค้า workflow");
    assert("card nextCtaLabel field", card.nextCtaLabel === null);
    assert("card where", card.routeFrom.includes("นิมมาน") && Boolean(card.routeTo?.includes("สนามบิน")));

    // --- Store recommendation / itinerary stop ---
    await store.upsertItineraryItem(pondOwner, booking.id, {
      title: "ดอยสุเทพ",
      location: "วัดพระธาตุดอยสุเทพ",
      dayNumber: 1,
      estimatedMinutes: 120,
      note: "คำแนะนำร้าน · ATTRACTION",
      placeId: null,
    });
    const withItinerary = await store.getBookingById(pondOwner, booking.id);
    assert("store recommendation saved", (withItinerary?.itinerary.length ?? 0) >= 1);

    // --- Combined vehicle+driver assign ---
    await store.assignBooking(pondOwner, booking.id, {
      vehicleId: SEED.vehicleSuv,
      driverId: SEED.driverPartner,
    });
    const assigned = await store.getBookingById(pondOwner, booking.id);
    assert(
      "combined assign",
      assigned?.booking.assignedVehicleId === SEED.vehicleSuv &&
        assigned?.booking.assignedDriverId === SEED.driverPartner,
    );
    const nextAssign = resolveBookingNextAction(assigned!.booking, [], settleBooking(assigned!.booking, []));
    assert("after assign → create offer", nextAssign.kind === "CREATE_OFFER");
    assert(
      "inbox ACTION while preparing offer",
      matchesOpsInboxFilter(
        assigned!.booking,
        settleBooking(assigned!.booking, []),
        "ACTION",
        { quotations: [] },
      ),
    );

    // --- Quotation with OT terms (no money) ---
    const draft = await store.createQuotationDraft(pondOwner, booking.id);
    assert("draft inherits POND OT defaults", draft.includedHoursPerDay === 8 && draft.overtimeRatePerHour === 200);

    const terms = composeOvertimeTerms("ราคาไม่รวมค่าทางด่วน", 8, 200);
    const saved = await store.updateQuotationDraft(pondOwner, draft.id, {
      items: [{ type: "VEHICLE_SERVICE", description: "ค่าบริการ", quantity: 1, unitPrice: 8000 }],
      discountAmount: 0,
      depositType: "FIXED_AMOUNT",
      depositValue: 2000,
      terms,
      includedHoursPerDay: 8,
      overtimeRatePerHour: 200,
      note: null,
    });
    assert("quote service 8000 deposit 2000", saved.totalAmount === 8000 && saved.depositRequiredAmount === 2000);
    assert("OT fields persisted", saved.includedHoursPerDay === 8 && saved.overtimeRatePerHour === 200);
    assert("OT terms text present", (saved.terms ?? "").includes("200") && (saved.terms ?? "").includes("8"));

    const movementsBeforeSend = await store.listMoneyMovements(pondOwner, SEED.businessPond);
    const relatedBefore = movementsBeforeSend.filter((item) => item.bookingId === booking.id);
    assert("OT term creates no MoneyMovement before send", relatedBefore.length === 0);

    const sent = await store.sendQuotation(pondOwner, draft.id);
    const afterSend = await store.getBookingById(pondOwner, booking.id);
    assert("sent quotation", sent.status === "SENT");
    assert("booking QUOTATION_SENT", afterSend?.booking.status === "QUOTATION_SENT");
    const nextWait = resolveBookingNextAction(
      afterSend!.booking,
      afterSend!.quotations,
      settleBooking(afterSend!.booking, afterSend!.movements),
    );
    assert("waiting customer next action", nextWait.kind === "WAIT_CUSTOMER" && nextWait.ctaLabel == null);
    assert(
      "inbox WAITING_CUSTOMER after quote",
      matchesOpsInboxFilter(afterSend!.booking, settleBooking(afterSend!.booking, afterSend!.movements), "WAITING_CUSTOMER"),
    );
    assert(
      "inbox ACTION false while waiting customer",
      !matchesOpsInboxFilter(afterSend!.booking, settleBooking(afterSend!.booking, afterSend!.movements), "ACTION", {
        quotations: afterSend!.quotations,
      }),
    );
    assert(
      "OT still no money after send",
      afterSend!.movements.length === 0 && afterSend!.booking.paidAmount === 0,
    );

    // Double-send blocked (immutability)
    let sendBlocked = false;
    try {
      await store.sendQuotation(pondOwner, draft.id);
    } catch {
      sendBlocked = true;
    }
    assert("cannot re-send same quotation", sendBlocked);

    // Versioning
    const revision = await store.createQuotationRevision(pondOwner, sent.id);
    assert("revision is draft next version", revision.status === "DRAFT" && revision.version === sent.version + 1);

    // Customer acceptance authority (token actor — not store)
    let storeAcceptBlocked = false;
    try {
      await store.acceptQuotation(pondOwner, sent.id);
    } catch {
      storeAcceptBlocked = true;
    }
    assert("store cannot accept quotation", storeAcceptBlocked);

    const accepted = await store.acceptQuotation(tokenActor(afterSend!.booking), sent.id);
    const afterAccept = await store.getBookingById(pondOwner, booking.id);
    assert("customer accepted", accepted.status === "CUSTOMER_ACCEPTED");
    assert("WAITING_DEPOSIT", afterAccept?.booking.status === "WAITING_DEPOSIT");
    assert("still no OT money after accept", afterAccept!.movements.length === 0);

    // Deposit proof + approve
    const slip = await store.writeSlipFile(tokenActor(afterAccept!.booking), {
      bookingId: booking.id,
      bytes: PNG,
      mime: "image/png",
      originalName: "dep.png",
    });
    const proof = await store.submitPaymentProof(tokenActor(afterAccept!.booking), {
      bookingId: booking.id,
      paymentIntent: "DEPOSIT",
      claimedAmount: 2000,
      allocations: allocationsFromIntent("DEPOSIT", 2000),
      slipFileId: slip.id,
      submittedBy: "CUSTOMER",
    });
    const pending = await store.getBookingById(pondOwner, booking.id);
    assert("pending slip not revenue", pending!.movements.length === 0);
    const nextProof = resolveBookingNextAction(
      pending!.booking,
      pending!.quotations,
      settleBooking(pending!.booking, pending!.movements),
      { pendingProof: true },
    );
    assert("next action review proof", nextProof.kind === "REVIEW_PROOF");

    await store.approvePaymentProof(pondOwner, proof.id);
    const confirmed = await store.getBookingById(pondOwner, booking.id);
    assert("confirmed after deposit", confirmed?.booking.status === "CONFIRMED");
    assert("deposit money movement exists", confirmed!.movements.length === 1);
    assert(
      "OT rate did not inflate deposit movement",
      confirmed!.movements[0].transferAmount === 2000,
    );

    // Tenant isolation — demo cannot open POND booking
    let isolated = false;
    try {
      await store.getBookingById(demoOwner, booking.id);
    } catch {
      isolated = true;
    }
    if (!isolated) {
      const sneaky = await store.getBookingById(demoOwner, booking.id);
      isolated = sneaky == null;
    }
    assert("Store #002 cannot access POND booking", isolated);

    await purgeByClientRequestPrefix(PREFIX);
    console.log(failed ? `\nFAILED ${failed}` : "\nALL PASS");
    process.exit(failed ? 1 : 0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
