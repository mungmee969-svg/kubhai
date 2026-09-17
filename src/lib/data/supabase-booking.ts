import type { BookingRequestInput } from "@/lib/domain/types";

export type DurableBookingResult = {
  id: string;
  token: string;
  bookingCode: string;
  reused: boolean;
  createdAt: string;
};

type RpcEnvelope = {
  id?: unknown;
  token?: unknown;
  bookingCode?: unknown;
  reused?: unknown;
  createdAt?: unknown;
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isDurableBookingConfigured() {
  return config() !== null;
}

export async function createDurableBookingRequest(
  input: BookingRequestInput,
): Promise<DurableBookingResult> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase booking persistence is not configured");

  const response = await fetch(`${cfg.url}/rest/v1/rpc/create_public_booking_request`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_payload: input }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Supabase booking RPC failed (${response.status}): ${detail}`);
  }

  const raw = (await response.json()) as RpcEnvelope;
  if (
    typeof raw.id !== "string" ||
    typeof raw.token !== "string" ||
    typeof raw.bookingCode !== "string" ||
    typeof raw.createdAt !== "string"
  ) {
    throw new Error("Supabase booking RPC returned an invalid response");
  }

  return {
    id: raw.id,
    token: raw.token,
    bookingCode: raw.bookingCode,
    reused: raw.reused === true,
    createdAt: raw.createdAt,
  };
}
