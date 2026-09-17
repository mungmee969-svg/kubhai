import { localStore } from "./local-store";
import type { Store } from "./repository";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function getStore(): Store {
  return localStore;
}

export { isBlockingStatus } from "@/lib/domain/booking-rules";
export {
  ConflictError,
  DomainError,
  TenantIsolationError,
} from "./repository";
