import { findAssignmentConflict } from "../src/lib/domain/availability";
import { canTransition } from "../src/lib/domain/booking-rules";
import { publicVehicle } from "../src/lib/domain/public-view";
import { LocalStore, purgeByClientRequestPrefix } from "../src/lib/data/local-store";
import { seedVehicles } from "../src/lib/data/seed";
import { SEED } from "../src/lib/data/seed-ids";
import type { Actor, Booking } from "../src/lib/domain/types";

const store = new LocalStore();
let failed = 0;

function assert(name: string, condition: unknown) {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
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

async function main() {
try {
const pond = await store.getPublicStore("pondcarrent");
assert("TEST 1 store /s/pondcarrent loads", pond?.business.slug === "pondcarrent");
assert("pilot store is not hardcoded as the only tenant", pond?.business.id !== SEED.businessDemo002);

const requestId = "TEST_P0_IDEMPOTENT";
const payload = {
  businessSlug: "pondcarrent",
  clientRequestId: requestId,
  serviceType: "PRIVATE_DRIVER_DAILY" as const,
  startDate: "2026-09-20",
  startTime: "09:00",
  endDate: "2026-09-20",
  endTime: null,
  passengerCount: 3,
  luggageCount: 2,
  pickupLocation: "CNX Airport",
  dropoffLocation: "Old City",
  tripNotes: null,
  letStorePlanTrip: false,
  preferredVehicleId: SEED.vehicleVan,
  placeIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"],
  customerName: "ลูกค้าทดสอบ",
  customerPhone: "0800000000",
  customerEmail: null,
  customerType: "PERSONAL" as const,
  companyName: null,
  taxId: null,
  source: "DIRECT" as const,
  sessionId: "session-test",
  referrer: null,
};

const first = await store.createBookingRequest(payload);
const second = await store.createBookingRequest(payload);
assert("TEST 2 double submit creates exactly one booking", first.booking.id === second.booking.id && second.reused);
assert("secure token is high entropy", first.booking.securePublicToken.length >= 32);
assert("sequential booking id is not the auth token", first.booking.id !== first.booking.securePublicToken);

const inbox = await store.listBookings(pondOwner, SEED.businessPond);
assert("TEST 3 admin receives booking for correct tenant", inbox.some((item) => item.id === first.booking.id));

const assigned = await store.assignBooking(pondOwner, first.booking.id, {
  vehicleId: SEED.vehicleVan,
  driverId: SEED.driverInternal,
});
assert("TEST 4 assign vehicle/driver", assigned.assignedVehicleId === SEED.vehicleVan);

const other: Booking = {
  ...first.booking,
  id: "conflict-booking",
  status: "CONFIRMED",
  assignedVehicleId: SEED.vehicleVan,
  assignedDriverId: SEED.driverInternal,
};
const conflict = findAssignmentConflict({
  bookings: [first.booking, other],
  vehicleId: SEED.vehicleVan,
  driverId: SEED.driverInternal,
  range: first.booking,
  ignoreBookingId: first.booking.id,
});
assert("TEST 4 conflict logic detects overlap", Boolean(conflict.vehicle && conflict.driver));

assert("status machine blocks illegal jump", !canTransition("REQUESTED", "COMPLETED"));
assert("status machine allows checking", canTransition("REQUESTED", "CHECKING_AVAILABILITY"));

try {
  await store.listBookings(demoOwner, SEED.businessPond);
  assert("TEST 12 store B cannot read store A", false);
} catch {
  assert("TEST 12 store B cannot read store A", true);
}

const publicV = publicVehicle(seedVehicles[0]);
assert("TEST 13 public vehicle hides plate", publicV.plateNumber === null);

const byToken = await store.getBookingByToken(first.booking.securePublicToken);
assert("token access works", byToken?.booking.bookingCode === first.booking.bookingCode);
const byBad = await store.getBookingByToken(first.booking.id);
assert("sequential id is not authorized", byBad === null);

const missing = await store.getPublicStore("not-a-real-store");
assert("unknown slug does not load", missing === null);
} finally {
  await purgeByClientRequestPrefix("TEST_P0_");
}

if (failed) {
  console.error(`\n${failed} checks failed`);
  process.exit(1);
}
console.log("\nP0 checks passed");
}

void main();
