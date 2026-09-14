import { localStore } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";

const actor = {
  kind: "user" as const,
  userId: SEED.userPondOwner,
  role: "BUSINESS_OWNER" as const,
  businessIds: [SEED.businessPond],
};

async function main() {
const existing = (await localStore.listBookings(actor, SEED.businessPond)).find(
  (item) => item.clientRequestId === "finance-closeout-a",
);
if (existing) {
  console.log("finance fixture exists", existing.bookingCode, existing.id);
  return;
}

const created = await localStore.createBookingRequest({
  businessSlug: "pondcarrent",
  clientRequestId: "finance-closeout-a",
  customerName: "คุณปิดยอด",
  customerPhone: "0819999001",
  customerEmail: null,
  customerType: "PERSONAL",
  companyName: null,
  taxId: null,
  serviceType: "PRIVATE_DRIVER_DAILY",
  startDate: "2026-09-11",
  startTime: "08:00",
  endDate: "2026-09-11",
  endTime: "17:00",
  passengerCount: 2,
  luggageCount: 1,
  pickupLocation: "นิมมาน",
  dropoffLocation: "ดอยสุเทพ",
  tripNotes: "งานทดสอบปิดยอด",
  letStorePlanTrip: false,
  preferredVehicleId: SEED.vehicleVan,
  placeIds: [],
  source: "DIRECT",
  sessionId: "finance-fixture",
  referrer: null,
});

await localStore.assignBooking(actor, created.booking.id, {
  vehicleId: SEED.vehicleVan,
  driverId: SEED.driverInternal,
});
await localStore.updateBookingStatus(actor, created.booking.id, "CHECKING_AVAILABILITY");
await localStore.updateBookingStatus(actor, created.booking.id, "AVAILABLE");
await localStore.updateBookingStatus(actor, created.booking.id, "QUOTATION_SENT");
await localStore.updateBookingStatus(actor, created.booking.id, "CUSTOMER_CONFIRMED");
await localStore.updateBookingStatus(actor, created.booking.id, "WAITING_DEPOSIT");
await localStore.updateBookingFinancePlan(actor, created.booking.id, {
  quotedTotal: 3000,
  depositAmount: 1000,
  driverFeeAmount: 1200,
});
await localStore.recordMoneyMovement(actor, created.booking.id, {
  direction: "IN",
  transferAmount: 1000,
  allocations: [{ kind: "DEPOSIT", amount: 1000 }],
  method: "โอน",
  reference: "deposit-fixture",
});
await localStore.updateBookingStatus(actor, created.booking.id, "CONFIRMED");
await localStore.updateBookingStatus(actor, created.booking.id, "IN_PROGRESS");
await localStore.completeBooking(actor, created.booking.id, {
  now: "2099-01-01T18:00:00.000+07:00",
});

const fresh = await localStore.getBookingById(actor, created.booking.id);
console.log("finance fixture", fresh?.booking.bookingCode, fresh?.booking.status, fresh?.booking.id);
}

void main();
