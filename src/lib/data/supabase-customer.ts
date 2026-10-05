type DurableCustomerAccount = {
  id: string;
  phone: string;
  phoneVerifiedAt: string | null;
  displayName: string | null;
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function rpc<T>(name: string, body: unknown): Promise<T> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase customer persistence is not configured");
  const response = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Supabase customer RPC ${name} failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as T;
}

export async function upsertDurablePilotCustomerAccount(input: {
  id: string;
  phone: string;
  displayName: string | null;
}): Promise<DurableCustomerAccount> {
  return rpc<DurableCustomerAccount>("upsert_pilot_customer_account", {
    p_id: input.id,
    p_phone: input.phone,
    p_display_name: input.displayName,
  });
}

export async function claimDurableBooking(input: {
  token: string;
  customerAccountId: string;
  phone: string;
}): Promise<{ id: string; customerAccountId: string }> {
  return rpc("claim_public_booking_request", {
    p_token: input.token,
    p_customer_account_id: input.customerAccountId,
    p_phone: input.phone,
  });
}
