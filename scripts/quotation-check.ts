import { LocalStore, purgeByClientRequestPrefix } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { allocationsFromIntent } from "../src/lib/domain/payment-accounts";
import { buildPaymentInstruction } from "../src/lib/domain/payment-instructions";
import { calculateQuotationTotals } from "../src/lib/domain/quotation";
import { settleBooking } from "../src/lib/domain/settlement";
import type { Actor, Booking } from "../src/lib/domain/types";
import type { QuotationDraftInput } from "../src/lib/data/repository";

const store = new LocalStore();
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

const PREFIX = "TEST_QUOTE_";
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function tokenActor(booking: Booking): Actor {
  return { kind: "booking_token", token: booking.securePublicToken };
}

function lines(totalVehicle: number, driver = 0): QuotationDraftInput {
  const items: QuotationDraftInput["items"] = [
    { type: "VEHICLE_SERVICE", description: "ค่ารถ / ค่าบริการ", quantity: 1, unitPrice: totalVehicle },
  ];
  if (driver) {
    items.push({ type: "DRIVER_SERVICE", description: "ค่าคนขับ", quantity: 1, unitPrice: driver });
  }
  return {
    items,
    discountAmount: 0,
    depositType: "FIXED_AMOUNT",
    depositValue: 1000,
    terms: "ทดสอบ",
  };
}

async function makeBooking(clientRequestId: string, company = false) {
  const created = await store.createBookingRequest({
    businessSlug: "pondcarrent",
    clientRequestId,
    customerName: company ? "บริษัททดสอบ" : "ลูกค้าใบเสนอราคา",
    customerPhone: "0810000888",
    customerEmail: company ? "billing@quote.test" : null,
    customerType: company ? "COMPANY" : "PERSONAL",
    companyName: company ? "บริษัท ทดสอบ จำกัด" : null,
    taxId: company ? "0105559999999" : null,
    serviceType: "PRIVATE_DRIVER_DAILY",
    startDate: "2026-12-01",
    startTime: "09:00",
    endDate: "2026-12-03",
    endTime: "17:00",
    passengerCount: 2,
    luggageCount: 1,
    pickupLocation: "ทดสอบใบเสนอราคา",
    dropoffLocation: "ดอยสุเทพ",
    tripNotes: null,
    letStorePlanTrip: false,
    preferredVehicleId: SEED.vehicleSuv,
    placeIds: [],
    source: "DIRECT",
    sessionId: clientRequestId,
    referrer: null,
  });
  await store.assignBooking(pondOwner, created.booking.id, {
    vehicleId: SEED.vehicleSuv,
    driverId: SEED.driverPartner,
  });
  await store.updateBookingStatus(pondOwner, created.booking.id, "CHECKING_AVAILABILITY");
  await store.updateBookingStatus(pondOwner, created.booking.id, "AVAILABLE");
  return created.booking;
}

async function submitDeposit(booking: Booking, amount: number) {
  const actor = tokenActor(booking);
  const slip = await store.writeSlipFile(actor, {
    bookingId: booking.id,
    bytes: PNG,
    mime: "image/png",
    originalName: "deposit.png",
  });
  return store.submitPaymentProof(actor, {
    bookingId: booking.id,
    paymentIntent: "DEPOSIT",
    claimedAmount: amount,
    allocations: allocationsFromIntent("DEPOSIT", amount),
    slipFileId: slip.id,
    submittedBy: "CUSTOMER",
  });
}

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);

    const percent = calculateQuotationTotals(
      [
        { type: "VEHICLE_SERVICE", description: "รถ", quantity: 1, unitPrice: 2500 },
        { type: "DRIVER_SERVICE", description: "คนขับ", quantity: 1, unitPrice: 500 },
      ],
      0,
      "PERCENTAGE",
      30,
    );
    assert("deposit 30% of 3000 is 900", percent.totalAmount === 3000 && percent.depositRequiredAmount === 900 && percent.balanceAmount === 2100);

    const bookingA = await makeBooking(`${PREFIX}A`);
    const draftA = await store.createQuotationDraft(pondOwner, bookingA.id);
    assert("create draft", draftA.status === "DRAFT" && draftA.version === 1 && draftA.quotationNumber.startsWith("QT-"));
    const customerHidden = await store.getQuotation(tokenActor(bookingA), draftA.id);
    assert("draft hidden from customer", customerHidden === null);

    const saved = await store.updateQuotationDraft(pondOwner, draftA.id, {
      ...lines(2500, 500),
      depositType: "FIXED_AMOUNT",
      depositValue: 1000,
    });
    assert("edit draft totals", saved.totalAmount === 3000 && saved.depositRequiredAmount === 1000 && saved.balanceAmount === 2000);

    const sentA = await store.sendQuotation(pondOwner, draftA.id);
    const afterSendA = await store.getBookingById(pondOwner, bookingA.id);
    assert("send quotation", sentA.status === "SENT" && Boolean(sentA.sentAt));
    assert("booking status QUOTATION_SENT", afterSendA?.booking.status === "QUOTATION_SENT");

    const accepted = await store.acceptQuotation(tokenActor(bookingA), sentA.id);
    const afterAcceptA = await store.getBookingById(pondOwner, bookingA.id);
    const settleAccept = settleBooking(afterAcceptA!.booking, afterAcceptA!.movements);
    const instruction = buildPaymentInstruction({
      bookingCode: afterAcceptA!.booking.bookingCode,
      account: afterAcceptA!.receivingAccount,
      settlement: settleAccept,
    });
    assert("accept status", accepted.status === "CUSTOMER_ACCEPTED" && Boolean(accepted.acceptedAt));
    assert("acceptedQuotationId", afterAcceptA!.booking.acceptedQuotationId === sentA.id);
    assert("commercials from quote", afterAcceptA!.booking.quotedTotal === 3000 && afterAcceptA!.booking.depositAmount === 1000);
    assert("accept creates no money", afterAcceptA!.movements.length === 0 && afterAcceptA!.booking.paidAmount === 0);
    assert("status WAITING_DEPOSIT", afterAcceptA!.booking.status === "WAITING_DEPOSIT");
    assert("payment instruction deposit 1000", instruction.purpose === "DEPOSIT" && instruction.expectedAmount === 1000);

    const proofA = await submitDeposit(afterAcceptA!.booking, 1000);
    const beforeApprove = await store.getBookingById(pondOwner, bookingA.id);
    const beforeSettle = settleBooking(beforeApprove!.booking, beforeApprove!.movements);
    assert("slip pending is not paid", beforeSettle.depositReceived === 0 && beforeApprove!.movements.length === 0);

    await store.approvePaymentProof(pondOwner, proofA.id);
    const afterApprove = await store.getBookingById(pondOwner, bookingA.id);
    const afterSettle = settleBooking(afterApprove!.booking, afterApprove!.movements);
    assert("approved deposit 1000", afterSettle.depositReceived === 1000 && afterApprove!.movements.length === 1);
    assert("deposit approved confirms booking", afterApprove!.booking.status === "CONFIRMED");

    const bookingB = await makeBooking(`${PREFIX}B`);
    const draftB = await store.createQuotationDraft(pondOwner, bookingB.id);
    await store.updateQuotationDraft(pondOwner, draftB.id, lines(2500, 500));
    const sentB1 = await store.sendQuotation(pondOwner, draftB.id);
    await store.requestQuotationChange(tokenActor(bookingB), sentB1.id, "ขอลดเหลือ 2 วัน");
    const afterChange = await store.getQuotation(pondOwner, sentB1.id);
    assert("change request stored", afterChange?.status === "CUSTOMER_CHANGE_REQUESTED" && afterChange.changeRequestText === "ขอลดเหลือ 2 วัน");

    const revB = await store.createQuotationRevision(pondOwner, sentB1.id);
    await store.updateQuotationDraft(pondOwner, revB.id, {
      ...lines(2400, 0),
      depositType: "FIXED_AMOUNT",
      depositValue: 800,
    });
    const sentB2 = await store.sendQuotation(pondOwner, revB.id);
    const v1after = await store.getQuotation(pondOwner, sentB1.id);
    assert("v1 superseded", v1after?.status === "SUPERSEDED" && v1after.version === 1);
    assert("v2 sent", sentB2.status === "SENT" && sentB2.version === 2 && sentB2.totalAmount === 2400);
    await store.acceptQuotation(tokenActor(bookingB), sentB2.id);
    const afterB = await store.getBookingById(pondOwner, bookingB.id);
    assert("accepted points v2", afterB?.booking.acceptedQuotationId === sentB2.id && afterB.booking.quotedTotal === 2400);

    const bookingC = await makeBooking(`${PREFIX}C`);
    const draftC = await store.createQuotationDraft(pondOwner, bookingC.id);
    await store.updateQuotationDraft(pondOwner, draftC.id, lines(2500, 500));
    const sentC = await store.sendQuotation(pondOwner, draftC.id);
    await store.rejectQuotation(tokenActor(bookingC), sentC.id, "แพงไป");
    const afterC = await store.getBookingById(pondOwner, bookingC.id);
    const rejected = afterC!.quotations.find((item) => item.id === sentC.id);
    assert("reject keeps booking", Boolean(afterC));
    assert("reject no obligation", afterC!.booking.acceptedQuotationId === null && afterC!.booking.quotedTotal === null);
    assert("reject no movement", afterC!.movements.length === 0);
    assert("reject reason kept", rejected?.status === "CUSTOMER_REJECTED" && rejected.rejectReason === "แพงไป");

    const bookingD = await makeBooking(`${PREFIX}D`);
    const draftD = await store.createQuotationDraft(pondOwner, bookingD.id);
    await store.updateQuotationDraft(pondOwner, draftD.id, {
      items: [{ type: "VEHICLE_SERVICE", description: "ค่ารถ / ค่าบริการ", quantity: 1, unitPrice: 1500 }],
      discountAmount: 0,
      depositType: "NONE",
      depositValue: 0,
    });
    const sentD = await store.sendQuotation(pondOwner, draftD.id);
    await store.acceptQuotation(tokenActor(bookingD), sentD.id);
    const afterD = await store.getBookingById(pondOwner, bookingD.id);
    const settleD = settleBooking(afterD!.booking, afterD!.movements);
    assert("no deposit required", afterD!.booking.depositAmount === 0 && afterD!.booking.quotedTotal === 1500);
    assert("no deposit fake paid", afterD!.booking.paidAmount === 0 && afterD!.movements.length === 0);
    assert("no-deposit status", afterD!.booking.status === "CUSTOMER_CONFIRMED");
    assert("finance not waiting deposit", settleD.state !== "WAITING_DEPOSIT");

    const bookingE = await makeBooking(`${PREFIX}E`);
    const draftE = await store.createQuotationDraft(pondOwner, bookingE.id);
    await store.updateQuotationDraft(pondOwner, draftE.id, {
      ...lines(2500, 500),
      validUntil: "2000-01-01T00:00:00.000Z",
    });
    const sentE = await store.sendQuotation(pondOwner, draftE.id);
    const loadedE = await store.getQuotation(pondOwner, sentE.id);
    assert("expired on load", loadedE?.status === "EXPIRED");
    let expiredBlocked = false;
    try {
      await store.acceptQuotation(tokenActor(bookingE), sentE.id);
    } catch (error) {
      expiredBlocked = error instanceof Error && error.message.includes("หมดอายุ");
    }
    assert("expired cannot accept", expiredBlocked);
    const revE = await store.createQuotationRevision(pondOwner, sentE.id);
    assert("admin can version after expiry", revE.status === "DRAFT" && revE.version === 2);

    let editBlocked = false;
    try {
      await store.updateQuotationDraft(pondOwner, sentA.id, lines(9999, 0));
    } catch {
      editBlocked = true;
    }
    let planBlocked = false;
    try {
      await store.updateBookingFinancePlan(pondOwner, bookingA.id, { quotedTotal: 9999 });
    } catch {
      planBlocked = true;
    }
    const revF = await store.createQuotationRevision(pondOwner, sentA.id);
    const afterF = await store.getBookingById(pondOwner, bookingA.id);
    assert("accepted quote in-place edit blocked", editBlocked);
    assert("finance plan cannot diverge", planBlocked);
    assert("revision allowed after money", revF.status === "DRAFT" && revF.version === 2);
    assert("historical payment unchanged", afterF!.movements.length === 1 && afterF!.booking.paidAmount === 1000);

    let isolated = false;
    try {
      await store.getQuotation(demoOwner, sentA.id);
    } catch {
      isolated = true;
    }
    let isolatedList = false;
    try {
      await store.listQuotations(demoOwner, SEED.businessPond);
    } catch {
      isolatedList = true;
    }
    assert("store 002 cannot read POND quotation", isolated);
    assert("store 002 cannot list POND quotations", isolatedList);

    const audits = await store.listAuditLogs(pondOwner, SEED.businessPond);
    const actions = new Set(audits.map((item) => item.action));
    assert(
      "audit events present",
      [
        "QUOTATION_CREATED",
        "QUOTATION_UPDATED",
        "QUOTATION_SENT",
        "QUOTATION_ACCEPTED",
        "QUOTATION_CHANGE_REQUESTED",
        "QUOTATION_REJECTED",
        "QUOTATION_SUPERSEDED",
      ].every((item) => actions.has(item)),
    );
  } finally {
    await purgeByClientRequestPrefix(PREFIX);
    const leftover = await store.listBookings(pondOwner, SEED.businessPond);
    assert(
      "cleanup removes TEST_QUOTE_ bookings",
      leftover.every((item) => !item.clientRequestId.startsWith(PREFIX)),
    );
    const leftoverQuotes = await store.listQuotations(pondOwner, SEED.businessPond);
    const leftoverIds = new Set(leftover.map((item) => item.id));
    assert(
      "cleanup removes quotation fixtures",
      leftoverQuotes.every((item) => leftoverIds.has(item.bookingId) || !item.quotationNumber.includes("TEST_QUOTE_")),
    );
  }

  if (failed) {
    console.error(`quotation-check failed: ${failed}`);
    process.exit(1);
  }
  console.log("quotation-check passed");
}

void main();
