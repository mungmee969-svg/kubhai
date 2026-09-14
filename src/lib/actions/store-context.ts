"use server";

import { cookies } from "next/headers";
import { STORE_CONTEXT_COOKIE } from "@/lib/auth/store-context";

export async function rememberStoreContextAction(slug: string) {
  if (!/^[a-z0-9-]{2,60}$/i.test(slug)) return;
  const jar = await cookies();
  jar.set(STORE_CONTEXT_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}
