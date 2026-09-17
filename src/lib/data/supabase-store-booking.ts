import { getDurableBookingByToken, isDurableBookingConfigured } from "@/lib/data/supabase-booking";
import type { Booking } from "@/lib/domain/types";

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

export async function listDurableStoreBookings(businessId: string): Promise<Booking[]> {
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

  const safeTokens = rows.flatMap((row) =>
    typeof row.businessId === "string" &&
    row.businessId === businessId &&
    typeof row.token === "string" &&
    row.token.length >= 48
      ? [row.token]
      : [],
  );

  const records = await Promise.all(safeTokens.map((token) => getDurableBookingByToken(token)));
  return records.flatMap((record) =>
    record && record.booking.businessId === businessId ? [record.booking] : [],
  );
}
