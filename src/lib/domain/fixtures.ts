import type { Booking, Customer, Driver, Vehicle } from "./types";

export const FIXTURE_PREFIXES = ["TEST_", "QA_"] as const;

export const KNOWN_FIXTURE_REQUEST_IDS = [
  "11111111-1111-4111-8111-aaaaaaaaaaa1",
  "finance-closeout-a",
  "fleet-visual-today-a",
  "fleet-visual-today-c",
  "fleet-visual-today-d",
] as const;

export const KNOWN_FIXTURE_CUSTOMER_NAMES = [
  "ลูกค้าทดสอบ",
  "ลูกค้า Phase2",
  "ลูกค้าทับ",
  "คุณปิดยอด",
] as const;

export const KNOWN_FIXTURE_CUSTOMER_PHONES = [
  "0800000000",
  "0822222222",
  "0833333333",
  "0819999001",
] as const;

export function hasFixturePrefix(value: string | null | undefined) {
  if (!value) return false;
  return FIXTURE_PREFIXES.some((prefix) => value.startsWith(prefix)) || value.startsWith("fleet-visual-");
}

export function isFixtureBooking(
  booking: Pick<Booking, "clientRequestId" | "customerNameSnapshot"> & {
    customerPhoneSnapshot?: string | null;
  },
) {
  if (hasFixturePrefix(booking.clientRequestId)) return true;
  if ((KNOWN_FIXTURE_REQUEST_IDS as readonly string[]).includes(booking.clientRequestId)) return true;
  if ((KNOWN_FIXTURE_CUSTOMER_NAMES as readonly string[]).includes(booking.customerNameSnapshot)) return true;
  return Boolean(
    booking.customerPhoneSnapshot &&
      (KNOWN_FIXTURE_CUSTOMER_PHONES as readonly string[]).includes(booking.customerPhoneSnapshot),
  );
}

export function isFixtureCustomer(customer: Pick<Customer, "name" | "phone">) {
  if ((KNOWN_FIXTURE_CUSTOMER_NAMES as readonly string[]).includes(customer.name)) return true;
  return Boolean(customer.phone && (KNOWN_FIXTURE_CUSTOMER_PHONES as readonly string[]).includes(customer.phone));
}

export function isFixtureVehicle(vehicle: Pick<Vehicle, "isSeed" | "model" | "description">) {
  if (vehicle.isSeed) return false;
  const hay = `${vehicle.model} ${vehicle.description ?? ""}`.toLowerCase();
  return hay.includes("phase2") || hay.includes("phase 2");
}

export function isFixtureDriver(driver: Pick<Driver, "isSeed" | "name">) {
  if (driver.isSeed) return false;
  return driver.name.includes("Phase2") || driver.name.includes("Phase 2");
}

export function operationalBookings<T extends Pick<Booking, "clientRequestId" | "customerNameSnapshot">>(
  bookings: T[],
) {
  return bookings.filter((item) => !isFixtureBooking(item));
}
