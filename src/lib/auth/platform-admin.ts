import { redirect } from "next/navigation";
import { actorFromSession, getSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export async function requirePlatformAdmin() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/store/login");
  return {
    session,
    actor: actorFromSession(session),
    store: getStore(),
  };
}
