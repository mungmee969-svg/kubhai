import { LocalStore, purgeTestBookings, purgeTestPaymentAccounts } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { settleBooking } from "../src/lib/domain/settlement";
import { allocationsFromIntent } from "../src/lib/domain/payment-accounts";
import type { Actor, Booking } from "../src/lib/domain/types";

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

const REQUEST_A = "TEST_PAYMENT_A";
const REQUEST_B = "TEST_PAYMENT_B";
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

async function makeBooking(clientRequestId: string) {
  const created = await store.createBookingRequest({
    businessSlug: "pondcarrent",
    clientRequestId,
    customerName: "ลูกค้าสลิป",
    customerPhone: "0810000999",
    customerEmail: null,
    customerType: "PERSONAL",
    companyName: null,
    taxId: null,
    serviceType: "PRIVATE_DRIVER_DAILY",
    startDate: "2026-11-21",
    startTime: "09:00",
    endDate: "2026-11-21",
    endTime: "17:00",
    passengerCount: 2,
    luggageCount: 1,
    pickupLocation: "ทดสอบสลิป",
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
  await store.updateBookingStatus(pondOwner, created.booking.id, "QUOTATION_SENT");
  await store.updateBookingStatus(pondOwner, created.booking.id, "CUSTOMER_CONFIRMED");
  await store.updateBookingStatus(pondOwner, created.booking.id, "WAITING_DEPOSIT");
  await store.updateBookingFinancePlan(pondOwner, created.booking.id, {
    quotedTotal: 3000,
    depositAmount: 1000,
    driverFeeAmount: 1200,
  });
  return created.booking;
}

async function submitProof(
  booking: Booking,
  intent: "DEPOSIT" | "SERVICE_BALANCE" | "TIP_RECEIVED" | "COMBINED_BALANCE_AND_TIP",
  claimed: number,
  service?: number,
  tip?: number,
) {
  const actor = { kind: "booking_token" as const, token: booking.securePublicToken };
  const slip = await store.writeSlipFile(actor, {
    bookingId: booking.id,
    bytes: PNG,
    mime: "image/png",
    originalName: `${intent}.png`,
  });
  return store.submitPaymentProof(actor, {
    bookingId: booking.id,
    paymentIntent: intent,
    claimedAmount: claimed,
    allocations: allocationsFromIntent(intent, claimed, service, tip),
    slipFileId: slip.id,
    submittedBy: "CUSTOMER",
  });
}

async function main() {
  try {
  await purgeTestBookings([REQUEST_A, REQUEST_B]);
  await purgeTestPaymentAccounts("ทดสอบ-");

  const bookingA = await makeBooking(REQUEST_A);
  assert("SCENARIO A default account is POND SCB", bookingA.receivingAccountId === SEED.accountPondScb);

  const second = await store.upsertPaymentAccount(pondOwner, SEED.businessPond, {
    displayName: "ทดสอบ-บัญชีสำรอง",
    accountType: "BANK_ACCOUNT",
    bankName: "Bangkok Bank",
    bankCode: "002",
    accountHolderName: "POND BACKUP",
    accountNumber: "5555666677",
    isDefault: false,
  });
  await store.setBookingReceivingAccount(pondOwner, bookingA.id, second.id);
  const afterOverride = await store.getBookingById(pondOwner, bookingA.id);
  assert("SCENARIO B booking uses second account", afterOverride?.booking.receivingAccountId === second.id);

  await store.setBookingReceivingAccount(pondOwner, bookingA.id, SEED.accountPondScb);
  const depositProof = await submitProof(bookingA, "DEPOSIT", 1000);
  const beforeApprove = await store.getBookingById(pondOwner, bookingA.id);
  const beforeSettle = settleBooking(beforeApprove!.booking, beforeApprove!.movements);
  assert("SCENARIO C before approval received unchanged", beforeSettle.depositReceived === 0 && beforeSettle.customerPaidTotal === 0);
  assert("pending review does not create movement", beforeApprove!.movements.length === 0);

  const approved = await store.approvePaymentProof(pondOwner, depositProof.id);
  const afterDeposit = await store.getBookingById(pondOwner, bookingA.id);
  const afterDepositSettle = settleBooking(afterDeposit!.booking, afterDeposit!.movements);
  assert("SCENARIO C deposit 1000 created once", afterDepositSettle.depositReceived === 1000 && afterDeposit!.movements.length === 1);
  assert("approved proof links movement", approved.proof.moneyMovementId === afterDeposit!.movements[0].id);

  const replay = await store.approvePaymentProof(pondOwner, depositProof.id);
  const afterReplay = await store.getBookingById(pondOwner, bookingA.id);
  assert("SCENARIO H double approve is idempotent", replay.reused && afterReplay!.movements.length === 1);

  const wrong = await submitProof(bookingA, "SERVICE_BALANCE", 2000);
  const paidBeforeReject = afterReplay!.booking.paidAmount;
  await store.rejectPaymentProof(pondOwner, wrong.id, { reason: "ยอดไม่ตรง", adminNote: "สลิปผิด" });
  const afterReject = await store.getBookingById(pondOwner, bookingA.id);
  assert(
    "SCENARIO D reject creates no money",
    afterReject!.movements.length === 1 && afterReject!.booking.paidAmount === paidBeforeReject,
  );
  assert("rejected proof stays in history", afterReject!.proofs.some((item) => item.id === wrong.id && item.reviewStatus === "REJECTED"));

  const replacement = await submitProof(bookingA, "SERVICE_BALANCE", 2000);
  await store.approvePaymentProof(pondOwner, replacement.id);
  const afterReplace = await store.getBookingById(pondOwner, bookingA.id);
  const replaceSettle = settleBooking(afterReplace!.booking, afterReplace!.movements);
  assert("SCENARIO E old proof remains rejected", afterReplace!.proofs.some((item) => item.id === wrong.id && item.reviewStatus === "REJECTED"));
  assert("SCENARIO E new proof approved", afterReplace!.proofs.some((item) => item.id === replacement.id && item.reviewStatus === "APPROVED"));
  assert("SCENARIO F remaining balance is 0", replaceSettle.remainingBalance === 0 && replaceSettle.customerPaidService === 3000);

  const snapshotProof = afterReplace!.proofs.find((item) => item.id === depositProof.id);
  await store.setDefaultPaymentAccount(pondOwner, second.id);
  const afterDefaultChange = await store.getPaymentProof(pondOwner, depositProof.id);
  assert(
    "SCENARIO I snapshot stays on original SCB account",
    snapshotProof?.receivingAccountSnapshot?.id === SEED.accountPondScb &&
      afterDefaultChange?.receivingAccountSnapshot?.id === SEED.accountPondScb &&
      afterDefaultChange?.receivingAccountSnapshot?.bankName === "SCB",
  );

  const bookingB = await makeBooking(REQUEST_B);
  const depositB = await submitProof(bookingB, "DEPOSIT", 1000);
  await store.approvePaymentProof(pondOwner, depositB.id);
  const combined = await submitProof(bookingB, "COMBINED_BALANCE_AND_TIP", 2300, 2000, 300);
  await store.approvePaymentProof(pondOwner, combined.id);
  const combinedRecord = await store.getBookingById(pondOwner, bookingB.id);
  const combinedSettle = settleBooking(combinedRecord!.booking, combinedRecord!.movements);
  const combinedMovement = combinedRecord!.movements.find((item) => item.paymentProofId === combined.id);
  assert("SCENARIO G actual transfer 2300", combinedMovement?.transferAmount === 2300);
  assert("SCENARIO G service complete and tip separate", combinedSettle.remainingBalance === 0 && combinedSettle.tipReceived === 300 && combinedSettle.customerPaidService === 3000);

  await store.recordMoneyMovement(pondOwner, bookingB.id, {
    direction: "OUT",
    transferAmount: 1500,
    allocations: [
      { kind: "DRIVER_PAYOUT", amount: 1200 },
      { kind: "TIP_PAYOUT", amount: 300 },
    ],
    payeeKind: "DRIVER",
    payeeId: SEED.driverPartner,
    payeeName: "คนขับทีม",
    sourceAccountId: SEED.accountPondScb,
  });
  const afterPayout = await store.getBookingById(pondOwner, bookingB.id);
  const payout = afterPayout!.movements.find((item) => item.direction === "OUT");
  assert(
    "SCENARIO J source account preserved",
    payout?.sourceAccountId === SEED.accountPondScb && payout.sourceAccountSnapshot?.bankName === "SCB" && payout.transferAmount === 1500,
  );
  const payoutSettle = settleBooking(afterPayout!.booking, afterPayout!.movements);
  assert("payout closes tip and driver due", payoutSettle.driverDue === 0 && payoutSettle.tipDue === 0);

  let isolatedAccounts = false;
  try {
    await store.listPaymentAccounts(demoOwner, SEED.businessPond);
  } catch {
    isolatedAccounts = true;
  }
  const isolatedProof = await store.getPaymentProof(demoOwner, depositProof.id);
  let isolatedSlip = false;
  try {
    await store.readSlipFile(demoOwner, depositProof.slipFileId);
  } catch {
    isolatedSlip = true;
  }
  assert("SCENARIO K store 002 cannot list POND accounts", isolatedAccounts);
  assert("SCENARIO K store 002 cannot read POND proof", isolatedProof === null);
  assert("SCENARIO K store 002 cannot read POND slip", isolatedSlip);

  await store.setDefaultPaymentAccount(pondOwner, SEED.accountPondScb);
  } finally {
    await store.setDefaultPaymentAccount(pondOwner, SEED.accountPondScb);
    await purgeTestBookings([REQUEST_A, REQUEST_B]);
    await purgeTestPaymentAccounts("ทดสอบ-");
  }

  if (failed) {
    console.error(`payment-proof-check failed: ${failed}`);
    process.exit(1);
  }
  console.log("payment-proof-check passed");
}

void main();
