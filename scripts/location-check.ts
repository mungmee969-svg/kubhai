/**
 * Location accuracy + pickup/dropoff check-in checks.
 * Fixtures: TEST_LOCATION_
 */
import {
  LocalStore,
  purgeByClientRequestPrefix,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import {
  distanceMeters,
  proximityBand,
} from "../src/lib/domain/location";
import { publicBookingRecord } from "../src/lib/domain/public-view";
import { settleBooking } from "../src/lib/domain/settlement";
import { canTripOps } from "../src/lib/domain/trip-permissions";
import type { Actor } from "../src/lib/domain/types";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_LOCATION_";

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

const customerActor: Actor = {
  kind: "customer",
  customerAccountId: "00000000-0000-4000-8000-000000000099",
};

async function makeConfirmed(id: string, structured = true, startDate = "2026-11-01") {
  const created = await store.createBookingRequest({
    businessSlug: "pondcarrent",
    clientRequestId: `${PREFIX}${id}`,
    customerName: "ลูกค้าโลเคชัน",
    customerPhone: "0899300001",
    customerEmail: null,
    customerType: "PERSONAL",
    companyName: null,
    taxId: null,
    serviceType: "PRIVATE_DRIVER_DAILY",
    startDate,
    startTime: "09:00",
    endDate: startDate,
    endTime: "18:00",
    passengerCount: 2,
    luggageCount: 1,
    pickupLocation: structured ? "สนามบินเชียงใหม่ (CNX)" : "ข้อความจุดรับอย่างเดียว",
    pickupLat: structured ? 18.7669 : null,
    pickupLng: structured ? 98.9626 : null,
    pickupAddress: structured ? "ตำบลสุเทพ อำเภอเมืองเชียงใหม่" : null,
    pickupPlaceId: structured ? "cm-airport" : null,
    pickupNote: structured ? "รอหน้า Lobby" : null,
    pickupSource: structured ? "SEARCH" : "MANUAL",
    dropoffLocation: structured ? "นิมมานเหมินทร์" : "ข้อความจุดส่ง",
    dropoffLat: structured ? 18.8002 : null,
    dropoffLng: structured ? 98.9675 : null,
    dropoffAddress: structured ? "ถนนนิมมานเหมินทร์ เชียงใหม่" : null,
    dropoffPlaceId: structured ? "cm-nimman" : null,
    dropoffNote: structured ? "ประตู 3" : null,
    dropoffSource: structured ? "SEARCH" : "MANUAL",
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
  ] as const) {
    await store.updateBookingStatus(pondOwner, created.booking.id, status);
  }
  await store.updateBookingFinancePlan(pondOwner, created.booking.id, {
    quotedTotal: 3500,
    depositAmount: 1000,
    driverFeeAmount: 1200,
  });
  return created.booking;
}

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);

    const structured = await makeConfirmed("S1", true, "2026-11-01");
    assert("structured pickup", structured.pickupLat === 18.7669 && structured.pickupNote === "รอหน้า Lobby");
    assert("structured dropoff", structured.dropoffLat === 18.8002 && structured.dropoffSource === "SEARCH");

    const legacy = await makeConfirmed("LEGACY", false, "2026-11-02");
    assert("legacy text fallback", legacy.pickupLocation.includes("ข้อความ") && legacy.pickupLat == null);

    const dNear = distanceMeters(
      { latitude: 18.7669, longitude: 98.9626 },
      { latitude: 18.7672, longitude: 98.9628 },
    );
    assert("pickup distance calculation", dNear < 150 && proximityBand(dNear) === "GOOD");

    const dFar = distanceMeters(
      { latitude: 18.7669, longitude: 98.9626 },
      { latitude: 18.7800, longitude: 98.9800 },
    );
    assert("far distance band", dFar > 500 && proximityBand(dFar) === "FAR");

    // Current-location style input validation via booking fields
    assert(
      "current-location input validation",
      typeof structured.pickupLat === "number" && structured.pickupLng != null,
    );

    const pickup = await store.recordTripCheckIn(pondOwner, structured.id, {
      kind: "PICKUP",
      latitude: 18.7671,
      longitude: 98.9627,
      accuracyMeters: 25,
      now: "2026-11-01T09:55:00.000+07:00",
    });
    assert("pickup check-in", pickup.kind === "PICKUP" && pickup.proximity === "GOOD");
    assert("expected location preserved after pickup check-in", structured.pickupLat === 18.7669);

    const refreshed = await store.getBookingById(pondOwner, structured.id);
    assert(
      "actual location preserved separately",
      refreshed?.tripCheckIns.some((item) => item.kind === "PICKUP" && item.latitude === 18.7671),
    );
    assert("denormalized pickupCheckedInAt", Boolean(refreshed?.booking.pickupCheckedInAt));

    const farJob = await makeConfirmed("FAR1", true, "2026-11-03");
    let needOverride = false;
    try {
      await store.recordTripCheckIn(pondOwner, farJob.id, {
        kind: "PICKUP",
        latitude: 18.82,
        longitude: 99.01,
      });
    } catch {
      needOverride = true;
    }
    assert("pickup override required when far", needOverride);

    const farOk = await store.recordTripCheckIn(pondOwner, farJob.id, {
      kind: "PICKUP",
      latitude: 18.82,
      longitude: 99.01,
      overrideReason: "GPS_INACCURATE",
      note: "สัญญาณอ่อน",
    });
    assert("pickup override", farOk.proximity === "FAR" && farOk.overrideReason === "GPS_INACCURATE");

    let startBlocked = false;
    try {
      await store.startTrip(pondOwner, legacy.id);
    } catch {
      startBlocked = true;
    }
    assert("start requires pickup check-in", startBlocked);

    const started = await store.startTrip(pondOwner, structured.id, {
      now: "2026-11-01T10:08:00.000+07:00",
    });
    assert("actualStartAt", started.actualStartAt === "2026-11-01T10:08:00.000+07:00");
    assert("status in progress after start", started.status === "IN_PROGRESS");

    const dupPickup = await store.recordTripCheckIn(pondOwner, structured.id, {
      kind: "PICKUP",
      latitude: 18.9,
      longitude: 99.1,
    });
    assert("duplicate check-in safe", dupPickup.id === pickup.id && dupPickup.latitude === pickup.latitude);

    const dropoff = await store.recordTripCheckIn(pondOwner, structured.id, {
      kind: "DROPOFF",
      latitude: 18.8005,
      longitude: 98.9678,
      accuracyMeters: 40,
      now: "2026-11-01T15:41:00.000+07:00",
    });
    assert("dropoff check-in", dropoff.kind === "DROPOFF" && dropoff.proximity === "GOOD");
    assert(
      "dropoff distance calculation",
      dropoff.distanceFromExpectedM != null && dropoff.distanceFromExpectedM < 150,
    );

    const farDrop = await makeConfirmed("FARDROP", true, "2026-11-04");
    await store.recordTripCheckIn(pondOwner, farDrop.id, {
      kind: "PICKUP",
      latitude: 18.7669,
      longitude: 98.9626,
    });
    await store.startTrip(pondOwner, farDrop.id);
    let dropNeedOverride = false;
    try {
      await store.recordTripCheckIn(pondOwner, farDrop.id, {
        kind: "DROPOFF",
        latitude: 18.85,
        longitude: 99.05,
      });
    } catch {
      dropNeedOverride = true;
    }
    assert("dropoff override required when far", dropNeedOverride);
    const dropOverride = await store.recordTripCheckIn(pondOwner, farDrop.id, {
      kind: "DROPOFF",
      latitude: 18.85,
      longitude: 99.05,
      overrideReason: "CUSTOMER_REQUESTED_OTHER",
    });
    assert("dropoff override", dropOverride.overrideReason === "CUSTOMER_REQUESTED_OTHER");

    const paidBefore = settleBooking(
      (await store.getBookingById(pondOwner, structured.id))!.booking,
      (await store.getBookingById(pondOwner, structured.id))!.movements,
    );
    assert("no financial side effect after check-in", paidBefore.customerPaidService === 0);

    const completed = await store.completeBooking(pondOwner, structured.id, {
      now: "2026-11-01T19:00:00.000+07:00",
    });
    assert("actualEndAt via closeout", Boolean(completed.actualEndAt) && completed.status === "COMPLETED");

    const early = await makeConfirmed("EARLY", true, "2026-11-05");
    await store.recordTripCheckIn(pondOwner, early.id, {
      kind: "PICKUP",
      latitude: 18.7669,
      longitude: 98.9626,
    });
    await store.startTrip(pondOwner, early.id);
    await store.recordTripCheckIn(pondOwner, early.id, {
      kind: "DROPOFF",
      latitude: 18.8002,
      longitude: 98.9675,
    });
    let earlyBlocked = false;
    try {
      await store.completeBooking(pondOwner, early.id, {
        now: "2026-11-05T12:00:00.000+07:00",
      });
    } catch {
      earlyBlocked = true;
    }
    assert("early closeout still enforced", earlyBlocked);
    const earlyDone = await store.completeBooking(pondOwner, early.id, {
      now: "2026-11-05T12:00:00.000+07:00",
      earlyCompletionReason: "CUSTOMER_REQUEST",
      earlyCompletionNote: "ลูกค้าขอจบ",
    });
    assert("early completion compatibility", earlyDone.status === "COMPLETED");

    // Expected vs actual preserved
    const after = await store.getBookingById(pondOwner, structured.id);
    assert(
      "expected vs actual preserved",
      after?.booking.pickupLat === 18.7669 &&
        after.tripCheckIns.find((item) => item.kind === "PICKUP")?.latitude === 18.7671,
    );

    // Unauthorized / tenant
    assert("driver permissions store staff", canTripOps(pondOwner, "CHECK_IN_PICKUP"));
    assert("customer cannot trip ops", !canTripOps(customerActor, "CHECK_IN_PICKUP"));

    let tenantBlocked = false;
    try {
      await store.recordTripCheckIn(demoOwner, structured.id, {
        kind: "PICKUP",
        latitude: 18.7669,
        longitude: 98.9626,
      });
    } catch {
      tenantBlocked = true;
    }
    assert("tenant isolation", tenantBlocked);

    let customerBlocked = false;
    try {
      await store.recordTripCheckIn(customerActor, structured.id, {
        kind: "PICKUP",
        latitude: 18.7669,
        longitude: 98.9626,
      });
    } catch {
      customerBlocked = true;
    }
    assert("unauthorized actor rejected", customerBlocked);

    // Customer ownership via public view stripping
    const pub = publicBookingRecord(after!);
    assert(
      "customer ownership public strips precise coords",
      pub.booking.pickupLat == null &&
        pub.booking.pickupLng == null &&
        pub.tripCheckIns.every((item) => item.latitude === 0 && item.longitude === 0),
    );

    // Location change after pickup requires reason
    let changeBlocked = false;
    try {
      await store.updateBookingTrip(pondOwner, structured.id, {
        pickupLocation: "จุดใหม่",
      });
    } catch {
      changeBlocked = true;
    }
    assert("location change after pickup requires reason", changeBlocked);
    const changed = await store.updateBookingTrip(pondOwner, structured.id, {
      pickupLocation: "จุดใหม่หลังเช็กอิน",
      locationChangeReason: "ลูกค้าขอเปลี่ยน",
    });
    assert("location change with reason", changed.pickupLocation === "จุดใหม่หลังเช็กอิน");
    assert("expected lat preserved when only label changed", changed.pickupLat === 18.7669);

    console.log("");
    console.log(failed === 0 ? "location-check: ALL PASS" : `location-check: ${failed} FAILED`);
  } finally {
    await purgeByClientRequestPrefix(PREFIX);
    console.log("fixture cleanup done");
  }

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
