import { cookies } from "next/headers";

export const STORE_CONTEXT_COOKIE = "kh_store_context";

/** Remember last store slug for account chrome (identity remains platform-level). */
export async function setStoreContextCookie(slug: string) {
  const jar = await cookies();
  jar.set(STORE_CONTEXT_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getStoreContextSlug(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(STORE_CONTEXT_COOKIE)?.value ?? null;
}
