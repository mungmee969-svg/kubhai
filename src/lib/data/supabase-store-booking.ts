import {
  getDurableBookingByToken,
  isDurableBookingConfigured,
  type DurableBookingRecord,
} from "@/lib/data/supabase-booking";
import type { Booking, Driver, Vehicle } from "@/lib/domain/types";

// Transitional server-only credential for the first production tenant. The DB
// stores only its SHA-256 hash. Move this to per-tenant secret storage when
// automated tenant provisioning is introduced. Never import this module into a
// client component.
const STORE_READ_TOKENS: Record<string, string> = {
  "33333333-3333-4333-8333-333333333333":
    "0eb92dc1145a3f4b1dfa8bc1cd6d09e3be00bebd5a4998e70b7e02f6e73732f0",
};

type StoreBookingEnvelope = {
  id?: unknown;
  businessId?: unknown;
  token?: unknown;
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function listTenantRows(businessId: string): Promise<StoreBookingEnvelope[]> {
  const cfg = config();
  const adminToken = STORE_READ_TOKENS[businessId];
  if (!cfg || !adminToken || !isDurableBookingConfigured()) return [];

  const response = await fetch(`${cfg.url}/rest/v1/rpc/list_store_booking_requests`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_business_id: businessId, p_admin_token: adminToken }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Durable store booking inbox failed (${response.status}): ${detail}`);
  }

  const rows = (await response.json()) as StoreBookingEnvelope[];
  if (!Array.isArray(rows)) throw new Error("Durable store booking inbox returned invalid data");
  return rows.filter((row) => row.businessId === businessId);
}

export async function listDurableStoreBookings(businessId: string): Promise<Booking[]> {
  const rows = await listTenantRows(businessId);
  const safeTokens = rows.flatMap((row) =>
    typeof row.token === "string" && row.token.length >= 48 ? [row.token] : [],
  );
  const records = await Promise.all(safeTokens.map((token) => getDurableBookingByToken(token)));
  return records.flatMap((record) =>
    record && record.booking.businessId === businessId ? [record.booking] : [],
  );
}

export async function getDurableStoreBookingById(
  businessId: string,
  bookingId: string,
): Promise<DurableBookingRecord | null> {
  const rows = await listTenantRows(businessId);
  const row = rows.find(
    (item) =>
      item.id === bookingId &&
      item.businessId === businessId &&
      typeof item.token === "string" &&
      item.token.length >= 48,
  );
  if (!row || typeof row.token !== "string") return null;
  const record = await getDurableBookingByToken(row.token);
  return record && record.booking.businessId === businessId && record.booking.id === bookingId
    ? record
    : null;
}


export async function assignDurableStoreBooking(
  businessId: string,
  bookingId: string,
  input: { vehicleId: string; driverId: string },
): Promise<boolean> {
  const cfg = config();
  const adminToken = STORE_READ_TOKENS[businessId];
  if (!cfg || !adminToken || !isDurableBookingConfigured()) return false;
  const response = await fetch(`${cfg.url}/rest/v1/rpc/assign_store_booking_request`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_business_id: businessId,
      p_booking_id: bookingId,
      p_admin_token: adminToken,
      p_vehicle_id: input.vehicleId,
      p_driver_id: input.driverId,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Durable store booking assignment failed (${response.status}): ${detail}`);
  }
  return true;
}


type FleetRpcVehicle = {
  id: string; business_id: string; ownership_type: Vehicle["ownershipType"]; vehicle_type: string;
  brand: string; model: string; year: number | null; color: string | null; plate_number: string | null;
  seats: number; luggage_capacity: number; description: string | null; amenities: string[] | null;
  base_price: number | null; pricing_unit: string | null; image_urls: string[] | null; cover_image_url?: string | null;
  status: Vehicle["status"]; active: boolean; is_seed: boolean; created_at: string; updated_at: string;
};
type FleetRpcDriver = {
  id: string; business_id: string; driver_type: Driver["driverType"]; name: string; nickname: string | null;
  phone: string | null; line_id: string | null; photo_url: string | null; license_number: string | null;
  status: Driver["status"]; active: boolean; is_seed: boolean; created_at: string; updated_at: string;
};

export async function getDurableStoreFleet(
  businessId: string,
): Promise<{ vehicles: Vehicle[]; drivers: Driver[] } | null> {
  const cfg = config();
  const adminToken = STORE_READ_TOKENS[businessId];
  if (!cfg || !adminToken) return null;
  const response = await fetch(`${cfg.url}/rest/v1/rpc/list_store_fleet`, {
    method: "POST",
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_business_id: businessId, p_admin_token: adminToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const raw = (await response.json()) as { vehicles?: FleetRpcVehicle[]; drivers?: FleetRpcDriver[] } | null;
  if (!raw) return null;
  return {
    vehicles: (raw.vehicles ?? []).map((v) => ({
      id: v.id, businessId: v.business_id, ownershipType: v.ownership_type, vehicleType: v.vehicle_type,
      brand: v.brand, model: v.model, year: v.year, color: v.color, plateNumber: v.plate_number,
      seats: v.seats, luggageCapacity: v.luggage_capacity, description: v.description,
      amenities: v.amenities ?? [], basePrice: v.base_price, pricingUnit: v.pricing_unit,
      imageUrls: v.image_urls ?? [], coverImageUrl: v.cover_image_url ?? null, status: v.status,
      active: v.active, isSeed: v.is_seed, createdAt: v.created_at, updatedAt: v.updated_at,
    })),
    drivers: (raw.drivers ?? []).map((d) => ({
      id: d.id, businessId: d.business_id, driverType: d.driver_type, name: d.name, nickname: d.nickname,
      phone: d.phone, lineId: d.line_id, photoUrl: d.photo_url, licenseNumber: d.license_number,
      status: d.status, active: d.active, isSeed: d.is_seed, createdAt: d.created_at, updatedAt: d.updated_at,
    })),
  };
}
