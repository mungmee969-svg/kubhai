import { LocalStore, purgeByClientRequestPrefix, purgeIdentifiedFixtures } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { findAssignmentConflict } from "../src/lib/domain/availability";
import { publicVehicle } from "../src/lib/domain/public-view";
import type { Actor } from "../src/lib/domain/types";

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

async function main() {
  try {
  await purgeByClientRequestPrefix("TEST_P2_");
  const superAuth = await store.authenticate("superadmin@kubhai.local", "kubhai-local-dev");
  const ownerAuth = await store.authenticate("owner@pondcarrent.local", "kubhai-local-dev");
  assert("SUPER ADMIN LOGIN", superAuth?.profile.role === "SUPER_ADMIN");
  assert("BUSINESS OWNER LOGIN", ownerAuth?.profile.role === "BUSINESS_OWNER");
  assert("POND STORE SEED", (await store.getPublicStore("pondcarrent"))?.business.slug === "pondcarrent");

  const created = await store.upsertVehicle(pondOwner, SEED.businessPond, {
    ownershipType: "OWN",
    vehicleType: "SEDAN",
    brand: "Honda",
    model: "City Phase2",
    year: 2020,
    color: "ดำ",
    plateNumber: "ตัวอย่าง-P2",
    seats: 4,
    luggageCapacity: 2,
    description: "รถทดสอบ Phase 2",
    amenities: ["แอร์"],
    basePrice: 1500,
    pricingUnit: "วัน",
    imageUrls: [],
    status: "ACTIVE",
    active: true,
  });
  const publicStore = await store.getPublicStore("pondcarrent");
  assert("TEST A active vehicle on storefront", publicStore?.vehicles.some((item) => item.id === created.id));
  assert(
    "TEST I public vehicles hide plates",
    Boolean(publicStore && publicStore.vehicles.every((item) => item.plateNumber === null)),
  );

  await store.setVehicleActive(pondOwner, created.id, false);
  const afterHide = await store.getPublicStore("pondcarrent");
  assert("TEST A inactive hidden from storefront", !afterHide?.vehicles.some((item) => item.id === created.id));

  const partner = await store.upsertVehicle(pondOwner, SEED.businessPond, {
    ownershipType: "PARTNER",
    vehicleType: "VAN",
    brand: "Hyundai",
    model: "H1 Phase2",
    year: null,
    color: null,
    plateNumber: "ตัวอย่าง-P2P",
    seats: 8,
    luggageCapacity: 5,
    description: null,
    amenities: [],
    basePrice: 2000,
    pricingUnit: "วัน",
    imageUrls: [],
    status: "ACTIVE",
    active: true,
  });
  assert("TEST B partner vehicle created", partner.ownershipType === "PARTNER");
  assert("TEST B public hides ownership plate", publicVehicle(partner).plateNumber === null);

  const internal = await store.upsertDriver(pondOwner, SEED.businessPond, {
    driverType: "INTERNAL",
    name: "คนขับ Phase2",
    nickname: "บี",
    phone: "000-000-0099",
    lineId: null,
    photoUrl: null,
    licenseNumber: "SECRET",
    status: "ACTIVE",
    active: true,
  });
  const partnerDriver = await store.upsertDriver(pondOwner, SEED.businessPond, {
    driverType: "PARTNER",
    name: "พาร์ทเนอร์ Phase2",
    nickname: null,
    phone: null,
    lineId: null,
    photoUrl: null,
    licenseNumber: null,
    status: "ACTIVE",
    active: true,
  });
  assert("TEST C drivers created", internal.driverType === "INTERNAL" && partnerDriver.driverType === "PARTNER");

  try {
    await store.listVehicles(demoOwner, SEED.businessPond);
    assert("TEST C/H tenant isolation vehicles", false);
  } catch {
    assert("TEST C/H tenant isolation vehicles", true);
  }

  const requestId = `TEST_P2_${crypto.randomUUID()}`;
  const payload = {
    businessSlug: "pondcarrent",
    clientRequestId: requestId,
    serviceType: "AIRPORT_TRANSFER" as const,
    startDate: "2026-10-01",
    startTime: "10:00",
    endDate: "2026-10-01",
    endTime: null,
    passengerCount: 2,
    luggageCount: 2,
    pickupLocation: "CNX",
    dropoffLocation: "Nimman",
    tripNotes: null,
    letStorePlanTrip: false,
    preferredVehicleId: partner.id,
    placeIds: [],
    customerName: "ลูกค้า Phase2",
    customerPhone: "0822222222",
    customerEmail: null,
    customerType: "PERSONAL" as const,
    companyName: null,
    taxId: null,
    source: "FACEBOOK" as const,
    sessionId: "phase2-session",
    referrer: null,
  };
  const first = await store.createBookingRequest(payload);
  const second = await store.createBookingRequest(payload);
  assert("TEST D one booking", first.booking.id === second.booking.id && second.reused);
  assert("TEST D tenant + source", first.booking.businessId === SEED.businessPond && first.booking.source === "FACEBOOK");
  assert("TEST D token", first.booking.securePublicToken.length >= 32);

  const inbox = await store.listBookings(pondOwner, SEED.businessPond);
  assert("TEST E inbox", inbox.some((item) => item.id === first.booking.id));

  await store.assignBooking(pondOwner, first.booking.id, {
    vehicleId: partner.id,
    driverId: internal.id,
  });
  const assigned = await store.getBookingById(pondOwner, first.booking.id);
  assert("TEST F assignment", assigned?.booking.assignedVehicleId === partner.id && assigned.booking.assignedDriverId === internal.id);

  await store.updateBookingStatus(pondOwner, first.booking.id, "CHECKING_AVAILABILITY");
  await store.updateBookingStatus(pondOwner, first.booking.id, "AVAILABLE");
  await store.updateBookingStatus(pondOwner, first.booking.id, "QUOTATION_SENT");
  await store.updateBookingStatus(pondOwner, first.booking.id, "CUSTOMER_CONFIRMED");
  await store.updateBookingStatus(pondOwner, first.booking.id, "WAITING_DEPOSIT");
  await store.updateBookingStatus(pondOwner, first.booking.id, "CONFIRMED");

  const overlap = await store.createBookingRequest({
    ...payload,
    clientRequestId: `TEST_P2_${crypto.randomUUID()}`,
    customerPhone: "0833333333",
    customerName: "ลูกค้าทับ",
  });
  await store.assignBooking(pondOwner, overlap.booking.id, {
    vehicleId: partner.id,
    driverId: internal.id,
  });
  await store.updateBookingStatus(pondOwner, overlap.booking.id, "CHECKING_AVAILABILITY");
  await store.updateBookingStatus(pondOwner, overlap.booking.id, "AVAILABLE");
  await store.updateBookingStatus(pondOwner, overlap.booking.id, "QUOTATION_SENT");
  await store.updateBookingStatus(pondOwner, overlap.booking.id, "CUSTOMER_CONFIRMED");
  await store.updateBookingStatus(pondOwner, overlap.booking.id, "WAITING_DEPOSIT");
  try {
    await store.updateBookingStatus(pondOwner, overlap.booking.id, "CONFIRMED");
    assert("TEST G hard conflict", false);
  } catch (error) {
    assert("TEST G hard conflict", error instanceof Error && error.message.includes("ทับช่วงวัน"));
  }

  const confirmed = await store.getBookingById(pondOwner, first.booking.id);
  const conflict = findAssignmentConflict({
    bookings: [
      confirmed!.booking,
      {
        ...overlap.booking,
        status: "CONFIRMED",
        assignedVehicleId: partner.id,
        assignedDriverId: internal.id,
      },
    ],
    vehicleId: partner.id,
    driverId: internal.id,
    range: overlap.booking,
    ignoreBookingId: overlap.booking.id,
  });
  assert("TEST G domain overlap", Boolean(conflict.vehicle && conflict.driver));

  const isolated = await store.getBookingById(demoOwner, first.booking.id);
  assert("TEST H store 002 cannot read pond booking", isolated === null);

  const publicBooking = await store.getBookingByToken(first.booking.id);
  assert("TEST I sequential id denied", publicBooking === null);
  try {
    await store.listDrivers({ kind: "public", sessionId: "anon" }, SEED.businessPond);
    assert("TEST I public cannot list drivers", false);
  } catch {
    assert("TEST I public cannot list drivers", true);
  }
  try {
    await store.listCustomers({ kind: "public", sessionId: "anon" }, SEED.businessPond);
    assert("TEST I public cannot list customers", false);
  } catch {
    assert("TEST I public cannot list customers", true);
  }

  const customers = await store.listCustomers(pondOwner, SEED.businessPond);
  assert("TEST customer reuse/create", customers.some((item) => item.phone === "0822222222"));
  } finally {
    await purgeByClientRequestPrefix("TEST_P2_");
    await purgeIdentifiedFixtures();
  }

  if (failed) {
    console.error(`\n${failed} checks failed`);
    process.exit(1);
  }
  console.log("\nPhase 2 checks passed");
}

void main();
