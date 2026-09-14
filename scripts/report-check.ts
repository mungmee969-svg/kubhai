import { LocalStore, purgeByClientRequestPrefix, purgeIdentifiedFixtures } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { buildStoreReport, resolveReportRange } from "../src/lib/domain/reporting";
import { settleBooking } from "../src/lib/domain/settlement";
import type { Actor, Booking, BookingStatus } from "../src/lib/domain/types";

const store = new LocalStore();
let failed = 0;

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`, condition);
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

const PREFIX = "TEST_REPORT_";
const RANGE_START = "2026-09-01";
const RANGE_END = "2026-09-30";

async function makeBooking(input: {
  clientRequestId: string;
  startDate: string;
  endDate?: string;
  customerName: string;
  customerPhone: string;
  pickup: string;
  dropoff: string;
  vehicleId?: string | null;
  driverId?: string | null;
  status: BookingStatus;
  quotedTotal?: number;
  depositAmount?: number;
  driverFeeAmount?: number;
}) {
  const created = await store.createBookingRequest({
    businessSlug: "pondcarrent",
    clientRequestId: input.clientRequestId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: null,
    customerType: "PERSONAL",
    companyName: null,
    taxId: null,
    serviceType: "PRIVATE_DRIVER_DAILY",
    startDate: input.startDate,
    startTime: "09:00",
    endDate: input.endDate ?? input.startDate,
    endTime: "17:00",
    passengerCount: 2,
    luggageCount: 1,
    pickupLocation: input.pickup,
    dropoffLocation: input.dropoff,
    tripNotes: null,
    letStorePlanTrip: false,
    preferredVehicleId: input.vehicleId ?? SEED.vehicleSuv,
    placeIds: [],
    source: "DIRECT",
    sessionId: input.clientRequestId,
    referrer: null,
  });
  if (input.vehicleId || input.driverId) {
    await store.assignBooking(pondOwner, created.booking.id, {
      vehicleId: input.vehicleId ?? null,
      driverId: input.driverId ?? null,
    });
  }
  const path: BookingStatus[] = [
    "CHECKING_AVAILABILITY",
    "AVAILABLE",
    "QUOTATION_SENT",
    "CUSTOMER_CONFIRMED",
    "WAITING_DEPOSIT",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
  ];
  const target = input.status;
  if (target === "CANCELLED" || target === "REJECTED") {
    await store.updateBookingStatus(pondOwner, created.booking.id, "CHECKING_AVAILABILITY");
    await store.updateBookingStatus(pondOwner, created.booking.id, "AVAILABLE");
    await store.updateBookingStatus(
      pondOwner,
      created.booking.id,
      target,
      target === "CANCELLED" ? { reason: "ทดสอบยกเลิก" } : undefined,
    );
  } else if (target !== "REQUESTED") {
    for (const status of path) {
      if (status === "COMPLETED") {
        const endDate = input.endDate ?? input.startDate;
        await store.completeBooking(pondOwner, created.booking.id, {
          now: `${endDate}T18:00:00.000+07:00`,
        });
      } else {
        await store.updateBookingStatus(pondOwner, created.booking.id, status);
      }
      if (status === target) break;
    }
  }
  if (input.quotedTotal != null || input.depositAmount != null || input.driverFeeAmount != null) {
    await store.updateBookingFinancePlan(pondOwner, created.booking.id, {
      quotedTotal: input.quotedTotal,
      depositAmount: input.depositAmount,
      driverFeeAmount: input.driverFeeAmount,
    });
  }
  const record = await store.getBookingById(pondOwner, created.booking.id);
  return record!.booking;
}

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);
    await purgeIdentifiedFixtures();

    const partnerVehicle = await store.upsertVehicle(pondOwner, SEED.businessPond, {
      ownershipType: "PARTNER",
      vehicleType: "VAN",
      brand: "Hyundai",
      model: "TEST_REPORT_H1 Phase2",
      year: 2022,
      color: "ขาว",
      plateNumber: "กท-REPORT1",
      seats: 10,
      luggageCapacity: 8,
      description: "TEST_REPORT Phase2 partner fixture",
      amenities: [],
      basePrice: 3500,
      pricingUnit: "วัน",
      imageUrls: [],
      status: "ACTIVE",
      active: true,
    });

    // Outside range (should not affect period booking totals)
    await makeBooking({
      clientRequestId: `${PREFIX}OUT`,
      startDate: "2026-08-10",
      customerName: "ลูกค้าเก่า",
      customerPhone: "0817000001",
      pickup: "สนามบินเชียงใหม่",
      dropoff: "นิมมาน",
      vehicleId: SEED.vehicleSuv,
      driverId: SEED.driverInternal,
      status: "COMPLETED",
      quotedTotal: 2000,
      depositAmount: 500,
    });

    // 10 in-range bookings: 6 completed, 2 cancelled, 2 confirmed/in progress
    // OWN Fortuner x3, OWN Van x1, PARTNER x2 among used jobs (4 OWN + 2 PARTNER)
    const specs: Array<Parameters<typeof makeBooking>[0]> = [
      {
        clientRequestId: `${PREFIX}01`,
        startDate: "2026-09-02",
        customerName: "ลูกค้า A",
        customerPhone: "0817000001",
        pickup: "สนามบินเชียงใหม่",
        dropoff: "นิมมาน",
        vehicleId: SEED.vehicleSuv,
        driverId: SEED.driverInternal,
        status: "COMPLETED",
        quotedTotal: 2500,
        depositAmount: 1000,
        driverFeeAmount: 800,
      },
      {
        clientRequestId: `${PREFIX}02`,
        startDate: "2026-09-04",
        customerName: "ลูกค้า A",
        customerPhone: "0817000001",
        pickup: "สนามบินเชียงใหม่",
        dropoff: "นิมมาน",
        vehicleId: SEED.vehicleSuv,
        driverId: SEED.driverInternal,
        status: "COMPLETED",
        quotedTotal: 2500,
        depositAmount: 1000,
        driverFeeAmount: 800,
      },
      {
        clientRequestId: `${PREFIX}03`,
        startDate: "2026-09-06",
        customerName: "ลูกค้า B",
        customerPhone: "0817000002",
        pickup: "สนามบินเชียงใหม่",
        dropoff: "ดอยสุเทพ",
        vehicleId: SEED.vehicleSuv,
        driverId: SEED.driverInternal,
        status: "COMPLETED",
        quotedTotal: 2000,
        depositAmount: 800,
        driverFeeAmount: 700,
      },
      {
        clientRequestId: `${PREFIX}04`,
        startDate: "2026-09-08",
        customerName: "ลูกค้า C",
        customerPhone: "0817000003",
        pickup: "ห้วยแก้ว",
        dropoff: "แม่ริม",
        vehicleId: SEED.vehicleVan,
        driverId: SEED.driverInternal,
        status: "COMPLETED",
        quotedTotal: 3000,
        depositAmount: 1000,
        driverFeeAmount: 900,
      },
      {
        clientRequestId: `${PREFIX}05`,
        startDate: "2026-09-10",
        customerName: "ลูกค้า D",
        customerPhone: "0817000004",
        pickup: "สนามบินเชียงใหม่",
        dropoff: "ปาย",
        vehicleId: partnerVehicle.id,
        driverId: SEED.driverPartner,
        status: "COMPLETED",
        quotedTotal: 4000,
        depositAmount: 1500,
        driverFeeAmount: 2000,
      },
      {
        clientRequestId: `${PREFIX}06`,
        startDate: "2026-09-12",
        customerName: "ลูกค้า E",
        customerPhone: "0817000005",
        pickup: "สนามบินเชียงใหม่",
        dropoff: "ปาย",
        vehicleId: partnerVehicle.id,
        driverId: SEED.driverPartner,
        status: "COMPLETED",
        quotedTotal: 4000,
        depositAmount: 1500,
        driverFeeAmount: 2000,
      },
      {
        clientRequestId: `${PREFIX}07`,
        startDate: "2026-09-14",
        customerName: "ลูกค้า F",
        customerPhone: "0817000006",
        pickup: "นิมมาน",
        dropoff: "แม่แตง",
        status: "CANCELLED",
      },
      {
        clientRequestId: `${PREFIX}08`,
        startDate: "2026-09-16",
        customerName: "ลูกค้า G",
        customerPhone: "0817000007",
        pickup: "นิมมาน",
        dropoff: "สันทราย",
        status: "REJECTED",
      },
      {
        clientRequestId: `${PREFIX}09`,
        startDate: "2026-09-18",
        customerName: "ลูกค้า H",
        customerPhone: "0817000008",
        pickup: "สนามบินเชียงใหม่",
        dropoff: "นิมมาน",
        status: "CONFIRMED",
        quotedTotal: 2200,
        depositAmount: 800,
        driverFeeAmount: 700,
      },
      {
        clientRequestId: `${PREFIX}10`,
        startDate: "2026-09-20",
        customerName: "ลูกค้า I",
        customerPhone: "0817000009",
        pickup: "สนามบินเชียงใหม่",
        dropoff: "ดอยสุเทพ",
        status: "IN_PROGRESS",
        quotedTotal: 1800,
        depositAmount: 600,
        driverFeeAmount: 500,
      },
    ];

    const created: Booking[] = [];
    for (const spec of specs) created.push(await makeBooking(spec));

    // Money fixture on completed jobs: service 10000, tip 1000, driver 3000, partner 2000, tip out 800
    // Put all service income on first few completed bookings via movements
    const completed = created.filter((item) => item.status === "COMPLETED");
    await store.recordMoneyMovement(pondOwner, completed[0].id, {
      direction: "IN",
      transferAmount: 10000,
      allocations: [
        { kind: "DEPOSIT", amount: 4000 },
        { kind: "SERVICE_BALANCE", amount: 6000 },
      ],
      occurredAt: "2026-09-05T10:00:00.000Z",
      receivingAccountId: SEED.accountPondScb,
    });
    await store.recordMoneyMovement(pondOwner, completed[1].id, {
      direction: "IN",
      transferAmount: 1000,
      allocations: [{ kind: "TIP_RECEIVED", amount: 1000 }],
      occurredAt: "2026-09-05T11:00:00.000Z",
      receivingAccountId: SEED.accountPondScb,
    });
    await store.recordMoneyMovement(pondOwner, completed[0].id, {
      direction: "OUT",
      transferAmount: 3000,
      allocations: [{ kind: "DRIVER_PAYOUT", amount: 3000 }],
      occurredAt: "2026-09-06T10:00:00.000Z",
      payeeKind: "DRIVER",
      payeeId: SEED.driverInternal,
      payeeName: "คนขับร้าน",
      sourceAccountId: SEED.accountPondScb,
    });
    await store.recordMoneyMovement(pondOwner, completed[4].id, {
      direction: "OUT",
      transferAmount: 2000,
      allocations: [{ kind: "PARTNER_PAYOUT", amount: 2000 }],
      occurredAt: "2026-09-11T10:00:00.000Z",
      payeeKind: "PARTNER",
      payeeId: SEED.driverPartner,
      payeeName: "พาร์ทเนอร์",
      sourceAccountId: SEED.accountPondScb,
    });
    await store.recordMoneyMovement(pondOwner, completed[1].id, {
      direction: "OUT",
      transferAmount: 800,
      allocations: [{ kind: "TIP_PAYOUT", amount: 800 }],
      occurredAt: "2026-09-06T12:00:00.000Z",
      payeeKind: "DRIVER",
      payeeId: SEED.driverInternal,
      payeeName: "คนขับร้าน",
      sourceAccountId: SEED.accountPondScb,
    });

    // Quotation on one booking
    const quoteBooking = created[8];
    const draft = await store.createQuotationDraft(pondOwner, quoteBooking.id);
    await store.updateQuotationDraft(pondOwner, draft.id, {
      items: [{ type: "VEHICLE_SERVICE", description: "ค่ารถ", quantity: 1, unitPrice: 2200 }],
      discountAmount: 0,
      depositType: "FIXED_AMOUNT",
      depositValue: 800,
    });
    await store.sendQuotation(pondOwner, draft.id);

    const board = await store.loadTenantBoard(pondOwner, SEED.businessPond);
    const movements = await store.listMoneyMovements(pondOwner, SEED.businessPond);
    const proofs = await store.listPaymentProofs(pondOwner, SEED.businessPond);
    const quotations = await store.listQuotations(pondOwner, SEED.businessPond);
    const bookings = board.bookings.filter((item) => item.clientRequestId.startsWith(PREFIX));

    const range = resolveReportRange("custom", RANGE_START, RANGE_END);
    const report = buildStoreReport({
      businessId: SEED.businessPond,
      range,
      bookings,
      vehicles: board.vehicles,
      drivers: board.drivers,
      customers: board.customers,
      movements: movements.filter((item) => bookings.some((b) => b.id === item.bookingId)),
      quotations: quotations.filter((item) => bookings.some((b) => b.id === item.bookingId)),
      proofs: proofs.filter((item) => bookings.some((b) => b.id === item.bookingId)),
    });

    assert("booking totals 10", report.booking.total === 10);
    assert("completed 6", report.booking.completed === 6);
    assert("cancelled+rejected 2", report.booking.cancelled + report.booking.rejected === 2);
    assert("service income 10000", report.income.serviceRevenue === 10000);
    assert("tip separation 1000", report.income.tipReceived === 1000 && report.overview.serviceRevenue === 10000);
    assert("total cash received 11000", report.income.totalCashIn === 11000);
    assert("driver+partner payouts 5000", report.expense.operationalPayouts === 5000);
    assert("tip payout 800", report.expense.tipPayout === 800);
    assert("total cash paid 5800", report.expense.totalCashOut === 5800);
    assert("OWN vehicles used 2", report.own.vehiclesUsed === 2);
    assert("OWN jobs 4", report.own.jobs === 4);
    assert("PARTNER vehicles used 1", report.partner.vehiclesUsed === 1);
    assert("PARTNER jobs 2", report.partner.jobs === 2);
    assert("driver report has rows", report.drivers.length >= 1);
    assert("repeat customer A in period", report.customers.repeatInPeriod >= 1);
    assert("route report present", report.routes.length >= 1);
    assert("quotation sent tracked", report.quotation.sent >= 1);
    assert("outside-range booking excluded from total", report.booking.total === 10);

    // Outstanding: confirmed booking with quoted but no payment
    const open = await store.getBookingById(pondOwner, created[8].id);
    const openSettle = settleBooking(open!.booking, open!.movements);
    assert("outstanding receivable exists", (openSettle.remainingBalance ?? 0) > 0);

    // Tenant isolation
    let denied = false;
    try {
      await store.listMoneyMovements(demoOwner, SEED.businessPond);
    } catch {
      denied = true;
    }
    const demoBoard = await store.loadTenantBoard(demoOwner, SEED.businessDemo002);
    const demoReport = buildStoreReport({
      businessId: SEED.businessDemo002,
      range,
      bookings: demoBoard.bookings,
      vehicles: demoBoard.vehicles,
      drivers: demoBoard.drivers,
      customers: demoBoard.customers,
      movements: await store.listMoneyMovements(demoOwner, SEED.businessDemo002),
      quotations: await store.listQuotations(demoOwner, SEED.businessDemo002),
      proofs: await store.listPaymentProofs(demoOwner, SEED.businessDemo002),
    });
    assert("store 002 cannot list POND movements", denied);
    assert("store 002 report has no POND bookings", demoReport.booking.total === 0);
    assert("date range model", range.start === RANGE_START && range.end === RANGE_END);
  } finally {
    await purgeByClientRequestPrefix(PREFIX);
    await purgeIdentifiedFixtures();
    const leftover = await store.listBookings(pondOwner, SEED.businessPond);
    assert(
      "cleanup removes TEST_REPORT_ bookings",
      leftover.every((item) => !item.clientRequestId.startsWith(PREFIX)),
    );
  }

  if (failed) {
    console.error(`report-check failed: ${failed}`);
    process.exit(1);
  }
  console.log("report-check passed");
}

void main();
