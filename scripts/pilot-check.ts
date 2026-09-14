import { LocalStore, persistLegacyMovementBackfill, purgeByClientRequestPrefix } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { allocationsFromIntent } from "../src/lib/domain/payment-accounts";
import { buildPaymentInstruction } from "../src/lib/domain/payment-instructions";
import { settleBooking } from "../src/lib/domain/settlement";
import type { Actor, Booking } from "../src/lib/domain/types";

const store = new LocalStore();
const REQUEST = "TEST_PILOT_POND";
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
  await purgeByClientRequestPrefix("TEST_PILOT_");
  const created = await store.createBookingRequest({
    businessSlug: "pondcarrent",
    clientRequestId: REQUEST,
    customerName: "ลูกค้าไพลอต",
    customerPhone: "0890000111",
    customerEmail: null,
    customerType: "PERSONAL",
    companyName: null,
    taxId: null,
    serviceType: "PRIVATE_DRIVER_DAILY",
    startDate: "2026-12-12",
    startTime: "09:00",
    endDate: "2026-12-12",
    endTime: "17:00",
    passengerCount: 2,
    luggageCount: 1,
    pickupLocation: "นิมมาน",
    dropoffLocation: "ดอยสุเทพ",
    tripNotes: null,
    letStorePlanTrip: false,
    preferredVehicleId: SEED.vehicleSuv,
    placeIds: [],
    source: "DIRECT",
    sessionId: REQUEST,
    referrer: null,
  });
  assert("receiving account assigned", created.booking.receivingAccountId === SEED.accountPondScb);

  const accounts = await store.listPaymentAccounts(pondOwner, SEED.businessPond);
  const account = accounts.find((item) => item.id === SEED.accountPondScb) ?? null;
  assert("POND QR configured", Boolean(account?.qrImagePath && account.qrDisplayEnabled));

  await store.assignBooking(pondOwner, created.booking.id, {
    vehicleId: SEED.vehicleSuv,
    driverId: SEED.driverPartner,
  });
  for (const status of [
    "CHECKING_AVAILABILITY",
    "AVAILABLE",
    "QUOTATION_SENT",
    "CUSTOMER_CONFIRMED",
    "WAITING_DEPOSIT",
  ] as const) {
    await store.updateBookingStatus(pondOwner, created.booking.id, status);
  }
  await store.updateBookingFinancePlan(pondOwner, created.booking.id, {
    quotedTotal: 3000,
    depositAmount: 1000,
    driverFeeAmount: 1200,
  });

  let record = await store.getBookingById(pondOwner, created.booking.id);
  let settlement = settleBooking(record!.booking, record!.movements);
  const depositInstruction = buildPaymentInstruction({
    bookingCode: record!.booking.bookingCode,
    account: record!.receivingAccount,
    settlement,
    purpose: "DEPOSIT",
  });
  assert("deposit instruction 1000", depositInstruction.expectedAmount === 1000 && depositInstruction.qrDisplayEnabled);

  const depositProof = await submitProof(created.booking, "DEPOSIT", 1000);
  record = await store.getBookingById(pondOwner, created.booking.id);
  settlement = settleBooking(record!.booking, record!.movements);
  assert("pending slip is not paid", settlement.depositReceived === 0 && depositProof.reviewStatus === "PENDING_REVIEW");

  await store.approvePaymentProof(pondOwner, depositProof.id);
  const replay = await store.approvePaymentProof(pondOwner, depositProof.id);
  record = await store.getBookingById(pondOwner, created.booking.id);
  settlement = settleBooking(record!.booking, record!.movements);
  assert("deposit approved once", settlement.depositReceived === 1000 && replay.reused && record!.movements.length === 1);

  await store.updateBookingStatus(pondOwner, created.booking.id, "CONFIRMED");
  await store.updateBookingStatus(pondOwner, created.booking.id, "IN_PROGRESS");
  await store.completeBooking(pondOwner, created.booking.id, {
    now: "2026-12-12T18:00:00.000+07:00",
  });
  record = await store.getBookingById(pondOwner, created.booking.id);
  settlement = settleBooking(record!.booking, record!.movements);
  const balanceInstruction = buildPaymentInstruction({
    bookingCode: record!.booking.bookingCode,
    account: record!.receivingAccount,
    settlement,
    purpose: "COMBINED_BALANCE_AND_TIP",
    tipAmount: 300,
  });
  assert("combined instruction 2300", balanceInstruction.transferTotal === 2300);
  assert("operational completed before finance closed", record!.booking.status === "COMPLETED" && settlement.state !== "CLOSED");

  const combined = await submitProof(created.booking, "COMBINED_BALANCE_AND_TIP", 2300, 2000, 300);
  await store.approvePaymentProof(pondOwner, combined.id);
  record = await store.getBookingById(pondOwner, created.booking.id);
  settlement = settleBooking(record!.booking, record!.movements);
  assert("service paid and tip separate", settlement.remainingBalance === 0 && settlement.tipReceived === 300 && settlement.tipDue === 300);

  await store.recordMoneyMovement(pondOwner, created.booking.id, {
    direction: "OUT",
    transferAmount: 1500,
    allocations: [
      { kind: "DRIVER_PAYOUT", amount: 1200 },
      { kind: "TIP_PAYOUT", amount: 300 },
    ],
    payeeKind: "PARTNER",
    payeeId: SEED.driverPartner,
    payeeName: "คนขับทีม",
    sourceAccountId: SEED.accountPondScb,
  });
  record = await store.getBookingById(pondOwner, created.booking.id);
  settlement = settleBooking(record!.booking, record!.movements);
  const payout = record!.movements.find((item) => item.direction === "OUT");
  assert("outgoing 1500 keeps source snapshot", payout?.transferAmount === 1500 && payout.sourceAccountSnapshot?.bankName === "SCB");
  assert("finance closed", settlement.state === "CLOSED" && record!.booking.status === "COMPLETED");

  const isolated = await store.getBookingById(
    { kind: "user", userId: SEED.userDemo002, role: "BUSINESS_OWNER", businessIds: [SEED.businessDemo002] },
    created.booking.id,
  );
  assert("tenant isolation", isolated === null);

  await persistLegacyMovementBackfill();
  } finally {
    await purgeByClientRequestPrefix("TEST_PILOT_");
  }
  const leftover = (await store.listBookings(pondOwner, SEED.businessPond)).some(
    (item) => item.clientRequestId === REQUEST,
  );
  assert("pilot fixture cleaned", !leftover);

  if (failed) {
    console.error(`pilot-check failed: ${failed}`);
    process.exit(1);
  }
  console.log("pilot-check passed");
}

void main();
