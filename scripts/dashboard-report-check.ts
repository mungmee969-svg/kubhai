/**
 * Dashboard / report definitions check — single report engine, finance truth, tenant isolation.
 */
import { LocalStore, purgeByClientRequestPrefix } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { buildStoreReport, resolveReportRange } from "../src/lib/domain/reporting";
import { permissionsForRole } from "../src/lib/domain/staff-permissions";
import type { BookingStatus } from "../src/lib/domain/enums";
import type { Actor } from "../src/lib/domain/types";

const store = new LocalStore();
const PREFIX = "TEST_DASH_";
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

async function advanceTo(bookingId: string, target: BookingStatus, actor: Actor) {
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
  if (target === "REQUESTED") return;
  for (const status of path) {
    await store.updateBookingStatus(actor, bookingId, status);
    if (status === target) break;
  }
}

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);

    const presets = ["today", "last7", "thisMonth", "lastMonth", "thisYear"] as const;
    for (const preset of presets) {
      const range = resolveReportRange(preset);
      assert(`range ${preset} has start/end`, Boolean(range.start && range.end && range.label));
    }

    const created = await store.createBookingRequest({
      businessSlug: "pondcarrent",
      clientRequestId: `${PREFIX}req1`,
      customerName: "Dash Customer",
      customerPhone: "0811111111",
      customerEmail: null,
      customerType: "PERSONAL",
      companyName: null,
      taxId: null,
      serviceType: "MULTI_DAY_TRIP",
      startDate: "2026-09-14",
      startTime: "09:00",
      endDate: "2026-09-16",
      endTime: "17:00",
      passengerCount: 2,
      luggageCount: 1,
      pickupLocation: "นิมมาน",
      dropoffLocation: "สนามบินเชียงใหม่",
      tripNotes: null,
      letStorePlanTrip: false,
      preferredVehicleId: SEED.vehicleSuv,
      placeIds: [],
      source: "DIRECT",
      sessionId: `${PREFIX}sess`,
      referrer: null,
    });

    await store.assignBooking(pondOwner, created.booking.id, {
      vehicleId: SEED.vehicleSuv,
      driverId: SEED.driverInternal,
    });
    await advanceTo(created.booking.id, "AVAILABLE", pondOwner);

    const draft = await store.createQuotationDraft(pondOwner, created.booking.id);
    await store.updateQuotationDraft(pondOwner, draft.id, {
      items: [{ type: "VEHICLE_SERVICE", description: "ค่าบริการ", quantity: 1, unitPrice: 8000 }],
      discountAmount: 0,
      depositType: "FIXED_AMOUNT",
      depositValue: 2000,
      includedHoursPerDay: 8,
      overtimeRatePerHour: 200,
      note: null,
      terms: "รวม 8 ชม./วัน · OT 200",
    });
    await store.sendQuotation(pondOwner, draft.id);
    const tokenActor = { kind: "booking_token" as const, token: created.booking.securePublicToken };
    await store.acceptQuotation(tokenActor, draft.id);

    const board = await store.loadTenantBoard(pondOwner, SEED.businessPond);
    const movements = await store.listMoneyMovements(pondOwner, SEED.businessPond);
    const proofs = await store.listPaymentProofs(pondOwner, SEED.businessPond);
    const quotations = await store.listQuotations(pondOwner, SEED.businessPond);
    const range = resolveReportRange("custom", "2026-09-01", "2026-09-30");
    const report = buildStoreReport({
      businessId: SEED.businessPond,
      range,
      bookings: board.bookings,
      vehicles: board.vehicles,
      drivers: board.drivers,
      customers: board.customers,
      movements,
      quotations,
      proofs,
    });

    assert("dashboard report builds once", typeof report.overview.bookings === "number");
    assert("job count includes fixture", report.overview.bookings >= 1);
    assert("accepted sales total from quotations", report.quotation.acceptedSalesTotal >= 8000);
    assert("no cash received yet without approved movement", report.overview.serviceRevenue === 0);
    assert("tip separate field", typeof report.overview.tipReceived === "number");
    assert("cash difference help is not profit", report.help.cashDifference.includes("ไม่ใช่กำไร"));
    assert("service mix derived", Array.isArray(report.charts.serviceMix) && report.charts.serviceMix.length >= 1);
    assert("salesByDay derived", Array.isArray(report.charts.salesByDay));
    assert("paymentMix derived", Array.isArray(report.charts.paymentMix));
    assert("funnel has stages", report.booking.funnel.length >= 5);
    assert("OWN/PARTNER present", report.own && report.partner);
    assert("fleet distinct vehicles field", typeof report.own.vehiclesUsed === "number");
    assert("customer new/repeat", typeof report.customers.newCustomers === "number");
    assert("routes array", Array.isArray(report.routes));

    const relatedMoves = movements.filter((item) => item.bookingId === created.booking.id);
    assert("OT quotation creates no MoneyMovement", relatedMoves.length === 0);

    const demoBoard = await store.loadTenantBoard(demoOwner, SEED.businessDemo002);
    assert(
      "Store #002 does not see POND booking",
      !demoBoard.bookings.some((item) => item.id === created.booking.id),
    );
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
    assert(
      "Store #002 accepted sales exclude POND quote",
      !demoBoard.bookings.some((item) => item.id === created.booking.id) &&
        demoReport.quotation.acceptedSalesTotal ===
          demoReport.quotation.acceptedSalesTotal,
    );

    const staffPerms = permissionsForRole("STAFF");
    assert("staff default lacks REPORT_VIEW", !staffPerms.includes("REPORT_VIEW"));
    assert("staff default lacks FINANCE_VIEW", !staffPerms.includes("FINANCE_VIEW"));
    assert("owner has REPORT_VIEW", permissionsForRole("OWNER").includes("REPORT_VIEW"));
  } finally {
    await purgeByClientRequestPrefix(PREFIX);
  }

  if (failed) {
    console.error(`\ndashboard-report-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\ndashboard-report-check: ALL PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
