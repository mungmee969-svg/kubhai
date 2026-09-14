"use server";

import { redirect } from "next/navigation";
import { clearSession, setSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { loginSchema } from "@/lib/validation/booking";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: "กรอกอีเมลและรหัสผ่านให้ครบ" };

  const store = getStore();
  const auth = await store.authenticate(parsed.data.email, parsed.data.password);
  if (!auth) return { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

  await setSession({
    userId: auth.profile.id,
    email: auth.profile.email,
    role: auth.profile.role,
    businessIds: auth.businessIds,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  });

  if (auth.profile.role === "SUPER_ADMIN") redirect("/admin");
  redirect("/store");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/store/login");
}
