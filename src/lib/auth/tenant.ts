import { redirect } from "next/navigation";
import { actorFromSession, defaultBusinessId, getSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import type { Actor, Business } from "@/lib/domain/types";

export async function requireStoreContext(requestedBusinessId?: string) {
  const session = await getSession();
  if (!session) redirect("/store/login");
  const actor = actorFromSession(session);
  const store = getStore();
  const businesses = await store.listBusinesses(actor);
  const businessId =
    (requestedBusinessId &&
    businesses.some((item) => item.id === requestedBusinessId)
      ? requestedBusinessId
      : null) ??
    defaultBusinessId(session) ??
    businesses[0]?.id;
  if (!businessId) {
    return {
      session,
      actor,
      store,
      businesses,
      businessId: null as string | null,
      business: null as Business | null,
    };
  }
  // Reject suspended / removed membership without waiting for cookie expiry
  if (session.role !== "SUPER_ADMIN") {
    const active = await store.assertActiveStoreMembership(session.userId, businessId);
    if (!active) {
      redirect("/store/login?reason=suspended");
    }
  }
  return {
    session,
    actor,
    store,
    businesses,
    businessId,
    business: businesses.find((item) => item.id === businessId) ?? null,
  };
}

export function assertActor(actor: Actor): asserts actor is Extract<Actor, { kind: "user" }> {
  if (actor.kind !== "user") {
    throw new Error("ต้องเข้าสู่ระบบ");
  }
}
