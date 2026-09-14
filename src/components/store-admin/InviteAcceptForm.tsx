"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptStaffInviteAction } from "@/lib/actions/staff";

export function InviteAcceptForm({
  token,
  defaultName,
  email,
}: {
  token: string;
  defaultName: string;
  email: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await acceptStaffInviteAction({
      token,
      password,
      confirmPassword,
      fullName,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/store");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-muted">{email}</p>
      <input
        className="h-11 w-full rounded-xl border border-line px-3"
        placeholder="ชื่อ"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
      />
      <input
        className="h-11 w-full rounded-xl border border-line px-3"
        type="password"
        placeholder="รหัสผ่าน"
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <input
        className="h-11 w-full rounded-xl border border-line px-3"
        type="password"
        placeholder="ยืนยันรหัสผ่าน"
        minLength={8}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl bg-[color:var(--store-accent,#C4A35A)] font-semibold text-[#1a1510] disabled:opacity-60"
      >
        เข้าร่วมร้าน
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
