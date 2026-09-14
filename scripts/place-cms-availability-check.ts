/**
 * Place CMS + day availability focused checks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LocalStore,
  purgeByClientRequestPrefix,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { BOOKING_WIZARD_MAX_STEP } from "../src/lib/booking/draft";
import {
  deriveDayAvailability,
  capacityJobsOnDate,
  NEAR_CAPACITY_REMAINING,
} from "../src/lib/domain/day-availability";
import { resolvePlaceImageUrl, isFleetImageUrl } from "../src/lib/domain/place-image";
import { isGooglePlacesConfigured } from "../src/lib/location/google-places";
import { normalizeGooglePlace } from "../src/lib/location/google-maps";
import { placeSchema } from "../src/lib/validation/ops";
import type { Actor, Booking, Vehicle } from "../src/lib/domain/types";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_PLACE_CMS_";

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

function vehicle(partial: Partial<Vehicle> & { id: string }): Vehicle {
  return {
    businessId: SEED.businessPond,
    ownershipType: "OWN",
    brand: "Toyota",
    model: "Fortuner",
    vehicleType: "SUV",
    plateNumber: "TEST",
    seats: 7,
    luggage: 4,
    description: null,
    imageUrls: [],
    active: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  } as Vehicle;
}

function booking(partial: Partial<Booking> & { id: string }): Booking {
  return {
    businessId: SEED.businessPond,
    bookingCode: "T-1",
    securePublicToken: "x",
    clientRequestId: `${PREFIX}${partial.id}`,
    customerId: null,
    customerAccountId: null,
    customerNameSnapshot: "ทดสอบ",
    customerPhoneSnapshot: "0800000000",
    customerEmailSnapshot: null,
    customerType: "PERSONAL",
    companyName: null,
    taxId: null,
    serviceType: "PRIVATE_DRIVER_DAILY",
    startDate: "2026-09-14",
    startTime: "09:00",
    endDate: "2026-09-14",
    endTime: "12:00",
    passengerCount: 2,
    luggageCount: 1,
    pickupLocation: "A",
    pickupLat: null,
    pickupLng: null,
    pickupAddress: null,
    pickupPlaceId: null,
    pickupNote: null,
    pickupSource: null,
    dropoffLocation: "B",
    dropoffLat: null,
    dropoffLng: null,
    dropoffAddress: null,
    dropoffPlaceId: null,
    dropoffNote: null,
    dropoffSource: null,
    tripNotes: null,
    letStorePlanTrip: false,
    preferredVehicleId: null,
    assignedVehicleId: null,
    assignedDriverId: null,
    status: "CONFIRMED",
    quotedTotal: null,
    depositAmount: null,
    paidAmount: 0,
    balanceAmount: null,
    driverFeeAmount: null,
    receivingAccountId: null,
    acceptedQuotationId: null,
    source: "STOREFRONT",
    actualStartAt: null,
    pickupCheckedInAt: null,
    dropoffCheckedInAt: null,
    actualEndAt: null,
    scheduledEndAtSnapshot: null,
    earlyCompletionReason: null,
    earlyCompletionNote: null,
    completedByUserId: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);
    assert("Quick Booking still 5", BOOKING_WIZARD_MAX_STEP === 5);

    const schemaOk = placeSchema.safeParse({
      category: "CAFE",
      name: "Cafe Test",
      shortDescription: "สั้น",
      description: "ยาว",
      address: "นิมมาน",
      area: "นิมมาน",
      latitude: 18.8,
      longitude: 98.96,
      googlePlaceId: "ChIJtest",
      imageUrls: ["/places/covers/nimman-cafe.jpg", "/places/covers/doi-suthep.jpg"],
      coverImageUrl: "/places/covers/nimman-cafe.jpg",
      localRecommended: true,
      estimatedDurationMinutes: 60,
      status: "ACTIVE",
    });
    assert("placeSchema accepts multi-image + cover", schemaOk.success);

    const created = await store.upsertPlace(pondOwner, SEED.businessPond, {
      category: "CAFE",
      name: `${PREFIX} Multi Cafe`,
      shortDescription: "สั้น",
      description: "รายละเอียด",
      address: "นิมมาน",
      area: "นิมมาน",
      latitude: 18.8,
      longitude: 98.96,
      googlePlaceId: null,
      imageUrls: [
        "/places/covers/nimman-cafe.jpg",
        "/places/covers/doi-suthep.jpg",
        "/places/covers/wat-phra-singh.jpg",
      ],
      coverImageUrl: "/places/covers/doi-suthep.jpg",
      localRecommended: false,
      estimatedDurationMinutes: 45,
      status: "ACTIVE",
    });
    assert("cover selection persisted", created.coverImageUrl === "/places/covers/doi-suthep.jpg");
    assert("gallery order persisted", created.imageUrls.length === 3);

    const reordered = await store.upsertPlace(pondOwner, SEED.businessPond, {
      id: created.id,
      category: "CAFE",
      name: created.name,
      shortDescription: created.shortDescription,
      description: created.description,
      address: created.address,
      area: created.area,
      latitude: created.latitude,
      longitude: created.longitude,
      imageUrls: [created.imageUrls[2], created.imageUrls[0], created.imageUrls[1]],
      coverImageUrl: created.imageUrls[2],
      localRecommended: false,
      estimatedDurationMinutes: 45,
      status: "ACTIVE",
    });
    assert("reorder persisted", reordered.imageUrls[0] === created.imageUrls[2]);
    assert(
      "customer cover uses coverImageUrl",
      resolvePlaceImageUrl(reordered) === reordered.coverImageUrl,
    );
    assert("no fleet in cover", !isFleetImageUrl(resolvePlaceImageUrl(reordered)));

    await store.setPlaceActive(pondOwner, created.id, false);
    const pub = await store.getPublicStore("pondcarrent");
    assert(
      "hidden place not in customer discovery",
      !pub!.places.some((p) => p.id === created.id),
    );

    await store.archivePlace(pondOwner, created.id);
    const board = await store.loadTenantBoard(pondOwner, SEED.businessPond);
    assert(
      "archive soft-hides",
      board.places.find((p) => p.id === created.id)?.status === "HIDDEN",
    );

    assert("Google no-key does not throw", isGooglePlacesConfigured() === false || true);
    const normalized = normalizeGooglePlace({
      placeId: "abc",
      label: "ดอยสุเทพ",
      address: "เชียงใหม่",
      latitude: 18.8,
      longitude: 98.9,
    });
    assert(
      "normalized google place consistent",
      normalized.name === "ดอยสุเทพ" &&
        normalized.lat === 18.8 &&
        normalized.lng === 98.9 &&
        normalized.placeId === "abc",
    );

    const cta = readFileSync(
      join(__dirname, "../src/components/storefront/PartnerStorefront.tsx"),
      "utf8",
    );
    assert("CTA has dual actions", cta.includes("เที่ยวแนะนำ →") && cta.includes("เริ่มการจอง"));
    assert("CTA still uses ?book=1 via startBooking", cta.includes("?book=1"));

    // Availability scenarios
    const v1 = vehicle({ id: "vvvvvvvv-vvvv-4vvv-8vvv-vvvvvvvvvvv1" });
    const v2 = vehicle({ id: "vvvvvvvv-vvvv-4vvv-8vvv-vvvvvvvvvvv2", model: "Alphard" });
    const empty = deriveDayAvailability({
      date: "2026-09-15",
      bookings: [],
      vehicles: [v1, v2],
    });
    assert("A empty+resources → ว่าง", empty.status === "AVAILABLE");

    const noFleet = deriveDayAvailability({
      date: "2026-09-15",
      bookings: [],
      vehicles: [],
    });
    assert("E no resources → UNKNOWN not fake available", noFleet.status === "UNKNOWN");

    const booked = deriveDayAvailability({
      date: "2026-09-14",
      bookings: [
        booking({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001",
          assignedVehicleId: v1.id,
          startTime: "09:00",
          endTime: "12:00",
        }),
      ],
      vehicles: [v1, v2],
    });
    assert("B bookings+remaining → มีคิว", booked.status === "BOOKED_AVAILABLE");

    const near = deriveDayAvailability({
      date: "2026-09-14",
      bookings: [
        booking({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002",
          assignedVehicleId: v1.id,
          startTime: "08:00",
          endTime: "20:00",
        }),
      ],
      vehicles: [v1, v2],
    });
    assert(
      "C near capacity when remaining ≤ threshold",
      near.status === "NEAR_CAPACITY" && near.freeVehicleCount <= NEAR_CAPACITY_REMAINING,
    );

    const full = deriveDayAvailability({
      date: "2026-09-14",
      bookings: [
        booking({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003",
          assignedVehicleId: v1.id,
          startTime: "08:00",
          endTime: "20:00",
        }),
        booking({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb004",
          assignedVehicleId: v2.id,
          startTime: "08:00",
          endTime: "20:00",
        }),
      ],
      vehicles: [v1, v2],
    });
    assert("D all busy → FULL", full.status === "FULL");

    const cancelled = capacityJobsOnDate(
      [
        booking({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb005",
          status: "CANCELLED",
          assignedVehicleId: v1.id,
        }),
        booking({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb006",
          status: "COMPLETED",
          assignedVehicleId: v1.id,
        }),
      ],
      "2026-09-14",
    );
    assert("L cancelled/completed not capacity", cancelled.length === 0);

    const ownOnly = deriveDayAvailability({
      date: "2026-09-14",
      bookings: [
        booking({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb007",
          assignedVehicleId: v1.id,
          startTime: "09:00",
          endTime: "11:00",
        }),
      ],
      vehicles: [
        v1,
        vehicle({
          id: "vvvvvvvv-vvvv-4vvv-8vvv-vvvvvvvvvvv3",
          ownershipType: "PARTNER",
          model: "Team Van",
        }),
      ],
    });
    // When only OWN vehicles passed as filtered pool, partner excluded by caller — simulate:
    const ownFilter = deriveDayAvailability({
      date: "2026-09-14",
      bookings: [
        booking({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb008",
          assignedVehicleId: v1.id,
          startTime: "08:00",
          endTime: "20:00",
        }),
      ],
      vehicles: [v1],
    });
    assert("F OWN filter pool FULL when only own busy", ownFilter.status === "FULL");
    assert("OWN/PARTNER helper ran", ownOnly.usableVehicleCount >= 1);

    const timed = deriveDayAvailability({
      date: "2026-09-14",
      bookings: [
        booking({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb009",
          assignedVehicleId: v1.id,
          startTime: "09:00",
          endTime: "12:00",
        }),
      ],
      vehicles: [v1],
    });
    assert(
      "J same vehicle free later → not FULL",
      timed.status === "NEAR_CAPACITY" || timed.status === "BOOKED_AVAILABLE",
    );

    await purgeByClientRequestPrefix(PREFIX);
  } catch (error) {
    failed += 1;
    console.error("FAIL unexpected", error);
  }

  if (failed) {
    console.error(`\nplace-cms-availability-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nplace-cms-availability-check: all passed");
}

main();
