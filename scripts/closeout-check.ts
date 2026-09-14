/**
 * Job closeout + financial protection checks.
 * Fixtures: TEST_CLOSEOUT_
 */
import {
  LocalStore,
  purgeByClientRequestPrefix,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { buildBookingCloseout } from "../src/lib/domain/closeout";
import { settleBooking } from "../src/lib/domain/settlement";
import { attentionReason, needsAttention } from "../src/lib/domain/settlement";
import type { Actor } from "../src/lib/domain/types";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_CLOSEOUT_";

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

async function makeBooking(id: string, endTime = "18:00") {
  const created = await store.createBookingRequest({
    businessSlug: "pondcarrent",
    clientRequestId: `${PREFIX}${id}`,
    customerName: "ลูกค้าปิดงาน",
    customerPhone: "0899200001",
    customerEmail: null,
    customerType: "PERSONAL",
    companyName: null,
    taxId: null,
    serviceType: "PRIVATE_DRIVER_DAILY",
    startDate: "2026-10-01",
    startTime: "09:00",
    endDate: "2026-10-01",
    endTime,
    passengerCount: 2,
    luggageCount: 1,
    pickupLocation: "นิมมาน",
    dropoffLocation: "ดอยสุเทพ",
    tripNotes: null,
    letStorePlanTrip: false,
    preferredVehicleId: SEED.vehicleSuv,
    placeIds: [],
    source: "DIRECT",
    sessionId: `${PREFIX}${id}`,
    referrer: null,
  });
  await store.assignBooking(pondOwner, created.booking.id, {
    vehicleId: SEED.vehicleSuv,
    driverId: SEED.driverInternal,
  });
  for (const status of [
    "CHECKING_AVAILABILITY",
    "AVAILABLE",
    "QUOTATION_SENT",
    "CUSTOMER_CONFIRMED",
    "WAITING_DEPOSIT",
    "CONFIRMED",
    "IN_PROGRESS",
  ] as const) {
    await store.updateBookingStatus(pondOwner, created.booking.id, status);
  }
  await store.updateBookingFinancePlan(pondOwner, created.booking.id, {
    quotedTotal: 3000,
    depositAmount: 1000,
    driverFeeAmount: 1200,
  });
  return created.booking;
}

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);

    // Normal completion (after scheduled end)
    const normal = await makeBooking("N1");
    const completed = await store.completeBooking(pondOwner, normal.id, {
      now: "2026-10-01T19:00:00.000+07:00",
    });
    assert("normal job completion", completed.status === "COMPLETED");

    // Early completion requires reason
    const early = await makeBooking("E1");
    let earlyBlocked = false;
    try {
      await store.completeBooking(pondOwner, early.id, {
        now: "2026-10-01T12:00:00.000+07:00",
      });
    } catch {
      earlyBlocked = true;
    }
    assert("early completion requires reason", earlyBlocked);

    const earlyDone = await store.completeBooking(pondOwner, early.id, {
      now: "2026-10-01T12:00:00.000+07:00",
      earlyCompletionReason: "CUSTOMER_REQUEST",
      earlyCompletionNote: "ลูกค้าขอกลับ",
    });
    assert("early job completion", earlyDone.status === "COMPLETED" && earlyDone.earlyCompletionReason === "CUSTOMER_REQUEST");
    assert("accepted quote protection", earlyDone.quotedTotal === 3000);

    const audits = await store.listAuditLogs(pondOwner, SEED.businessPond);
    assert(
      "early completion audit",
      audits.some((item) => item.action === "BOOKING_COMPLETED_EARLY" && item.entityId === early.id),
    );

    // Outstanding after completion
    const unpaid = await makeBooking("U1");
    await store.recordMoneyMovement(pondOwner, unpaid.id, {
      direction: "IN",
      transferAmount: 1000,
      allocations: [{ kind: "DEPOSIT", amount: 1000 }],
      method: "โอน",
    });
    await store.completeBooking(pondOwner, unpaid.id, {
      now: "2026-10-01T19:00:00.000+07:00",
      acknowledgeOutstanding: true,
    });
    let record = await store.getBookingById(pondOwner, unpaid.id);
    const settlement = settleBooking(record!.booking, record!.movements);
    let closeout = buildBookingCloseout(record!.booking, record!.movements, {
      vehicle: record!.vehicle,
    });
    assert("outstanding after completion", closeout.customerOutstanding === 2000 && record!.booking.status === "COMPLETED");
    assert(
      "completed but unpaid attention",
      needsAttention(record!.booking, settlement) &&
        attentionReason(record!.booking, settlement)?.includes("ค้างชำระ"),
    );
    assert("outstanding badge", Boolean(closeout.outstandingBadge?.includes("ค้างชำระ")));

    // Pending proof does not reduce outstanding
    const tokenActor = { kind: "booking_token" as const, token: record!.booking.securePublicToken };
    const png = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    );
    const slip = await store.writeSlipFile(tokenActor, {
      bookingId: unpaid.id,
      bytes: png,
      mime: "image/png",
    });
    await store.submitPaymentProof(tokenActor, {
      bookingId: unpaid.id,
      paymentIntent: "SERVICE_BALANCE",
      claimedAmount: 2000,
      allocations: [{ kind: "SERVICE_BALANCE", amount: 2000 }],
      slipFileId: slip.id,
      submittedBy: "CUSTOMER",
    });
    record = await store.getBookingById(pondOwner, unpaid.id);
    closeout = buildBookingCloseout(record!.booking, record!.movements, { vehicle: record!.vehicle });
    assert("pending proof does not reduce outstanding", closeout.customerOutstanding === 2000);

    // Approved balance payment reduces outstanding + combined tip
    const slip2 = await store.writeSlipFile(tokenActor, {
      bookingId: unpaid.id,
      bytes: png,
      mime: "image/png",
    });
    // reject pending first? submit blocks if pending - approve or reject existing
    const pending = record!.proofs.find((item) => item.reviewStatus === "PENDING_REVIEW");
    if (pending) await store.rejectPaymentProof(pondOwner, pending.id, { reason: "ทดสอบ" });
    const proof = await store.submitPaymentProof(tokenActor, {
      bookingId: unpaid.id,
      paymentIntent: "COMBINED_BALANCE_AND_TIP",
      claimedAmount: 2300,
      allocations: [
        { kind: "SERVICE_BALANCE", amount: 2000 },
        { kind: "TIP_RECEIVED", amount: 300 },
      ],
      slipFileId: slip2.id,
      submittedBy: "CUSTOMER",
    });
    await store.approvePaymentProof(pondOwner, proof.id);
    record = await store.getBookingById(pondOwner, unpaid.id);
    closeout = buildBookingCloseout(record!.booking, record!.movements, { vehicle: record!.vehicle });
    assert("approved balance payment reduces outstanding", closeout.customerOutstanding === 0);
    assert("combined balance + tip", closeout.serviceCashReceived === 3000 && closeout.tipReceived === 300);
    assert("driver payout outstanding after service completion", closeout.driverPayoutOutstanding === 1200);
    assert("tip payout outstanding", closeout.tipPayoutOutstanding === 300);

    await store.recordMoneyMovement(pondOwner, unpaid.id, {
      direction: "OUT",
      transferAmount: 1200,
      allocations: [{ kind: "DRIVER_PAYOUT", amount: 1200 }],
      payeeKind: "DRIVER",
      payeeId: SEED.driverInternal,
      payeeName: "Internal",
      method: "โอน",
      sourceAccountId: SEED.accountPondScb,
    });
    await store.recordMoneyMovement(pondOwner, unpaid.id, {
      direction: "OUT",
      transferAmount: 300,
      allocations: [{ kind: "TIP_PAYOUT", amount: 300 }],
      payeeKind: "DRIVER",
      payeeId: SEED.driverInternal,
      payeeName: "Internal",
      method: "โอน",
      sourceAccountId: SEED.accountPondScb,
    });
    record = await store.getBookingById(pondOwner, unpaid.id);
    closeout = buildBookingCloseout(record!.booking, record!.movements, { vehicle: record!.vehicle });
    assert("financial closeout", closeout.financiallyClosed === true);

    // Partner / driver payout fields after completion
    const partnerJob = await makeBooking("P1");
    await store.completeBooking(pondOwner, partnerJob.id, {
      now: "2026-10-01T19:00:00.000+07:00",
    });
    record = await store.getBookingById(pondOwner, partnerJob.id);
    closeout = buildBookingCloseout(record!.booking, record!.movements, { vehicle: record!.vehicle });
    assert(
      "partner/driver payout fields present",
      typeof closeout.partnerPayoutOutstanding === "number" && typeof closeout.driverPayoutOutstanding === "number",
    );
    assert("driver payout outstanding on OWN vehicle", closeout.driverPayoutOutstanding === 1200);

    // Idempotent completion
    const again = await store.completeBooking(pondOwner, unpaid.id, {
      now: "2026-10-01T20:00:00.000+07:00",
    });
    assert("idempotency", again.status === "COMPLETED" && again.quotedTotal === 3000);

    // Tenant isolation
    const isolated = await store.getBookingById(demoOwner, unpaid.id);
    assert("tenant isolation", isolated === null);

    // Block silent COMPLETED via updateBookingStatus
    const block = await makeBooking("B1");
    let blockedStatus = false;
    try {
      await store.updateBookingStatus(pondOwner, block.id, "COMPLETED");
    } catch {
      blockedStatus = true;
    }
    assert("early completion cannot be silently bypassed via status", blockedStatus);
  } finally {
    const removed = await purgeByClientRequestPrefix(PREFIX);
    assert("test cleanup", removed.length >= 1);
  }

  if (failed) {
    console.error(`closeout-check failed (${failed})`);
    process.exit(1);
  }
  console.log("closeout-check passed");
}

void main();
