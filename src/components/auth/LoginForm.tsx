"use client";

import { useActionState } from "react";
import { loginAction, type ActionResult } from "@/lib/actions/auth";

const initial: ActionResult | null = null;

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm text-white/80">อีเมล</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="h-12 w-full rounded-2xl bg-white px-4 text-ink outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-white/80">รหัสผ่าน</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-12 w-full rounded-2xl bg-white px-4 text-ink outline-none"
        />
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-accent-bright">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-accent text-navy-950 text-base font-semibold disabled:opacity-60"
      >
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
