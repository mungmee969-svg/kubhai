import type { BookingRecord } from "@/lib/data/repository";
import { publicPaymentAccount, publicPaymentProof } from "./payment-accounts";
import { revealsAssignment } from "./booking-rules";
import type { Driver, Vehicle } from "./types";

export function publicVehicle(vehicle: Vehicle): Vehicle {
  return { ...vehicle, plateNumber: null };
}

export function publicDriver(driver: Driver | null, status: BookingRecord["booking"]["status"]) {
  if (!driver || !revealsAssignment(status)) return null;
  return {
    id: driver.id,
    businessId: driver.businessId,
    driverType: driver.driverType,
    name: driver.name,
    nickname: driver.nickname,
    phone: driver.phone,
    lineId: null,
    photoUrl: driver.photoUrl,
    licenseNumber: null,
    status: driver.status,
    active: driver.active,
    isSeed: driver.isSeed,
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  } satisfies Driver;
}

export function publicBookingRecord(record: BookingRecord): BookingRecord {
  return {
    ...record,
    vehicle: record.vehicle ? publicVehicle(record.vehicle) : null,
    preferredVehicle: record.preferredVehicle
      ? publicVehicle(record.preferredVehicle)
      : null,
    driver: publicDriver(record.driver, record.booking.status),
    customer: null,
    notes: record.notes.filter((item) => item.audience === "CUSTOMER"),
    movements: [],
    // Customer-safe: progress timestamps only — no precise GPS coordinates
    tripCheckIns: record.tripCheckIns.map((item) => ({
      ...item,
      latitude: 0,
      longitude: 0,
      accuracyMeters: null,
    })),
    proofs: record.proofs.map(publicPaymentProof),
    receivingAccount: record.receivingAccount
      ? {
          ...publicPaymentAccount(record.receivingAccount),
        }
      : null,
    auditLogs: [],
    booking: {
      ...record.booking,
      // Keep place labels; strip precise coordinates from public token payload
      pickupLat: null,
      pickupLng: null,
      dropoffLat: null,
      dropoffLng: null,
    },
  };
}
