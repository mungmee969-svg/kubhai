import { localStore } from "./local-store";
import type { Store } from "./repository";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getStore(): Store {
  if (isSupabaseConfigured()) {
    throw new Error(
      "Supabase env is set but the live adapter is not wired yet. Unset NEXT_PUBLIC_SUPABASE_URL to use the local store, or continue P1 with the Supabase adapter.",
    );
  }
  return localStore;
}

export { isBlockingStatus } from "@/lib/domain/booking-rules";
export {
  ConflictError,
  DomainError,
  TenantIsolationError,
} from "./repository";
