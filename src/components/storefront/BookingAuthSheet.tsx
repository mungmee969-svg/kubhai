"use client";

import { useState } from "react";
import { OtpInput } from "@/components/account/OtpInput";
import { StoreLogo } from "@/components/brand/StoreBrand";
import {
  customerLoginAction,
  customerSignupCompleteAction,
  customerSignupStartAction,
} from "@/lib/actions/customer-auth";
import type { BusinessBranding } from "@/lib/domain/branding";

type Mode = "login" | "signup";
type SignupStep = "otp" | "password";

const INPUT =
  "h-12 w-full rounded-[1rem] border border-[color:var(--store-line,#E8E2D8)] bg-white px-3.5 text-[0.95rem] outline-none focus:border-[color:var(--store-accent,#C4A35A)] focus:ring-[3px] focus:ring-[color:var(--store-accent,#C4A35A)]/25";
const CTA =
  "h-12 w-full rounded-[1.05rem] bg-[color:var(--store-accent,#C4A35A)] text-[0.95rem] font-semibold text-[#1a1510] disabled:opacity-60";

function BookingAuthSheetBody({
  brand,
  initialPhone,
  initialName,
  onClose,
  onAuthenticated,
}: {
  brand: BusinessBranding;
  initialPhone: string;
  initialName?: string;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [signupStep, setSignupStep] = useState<SignupStep>("otp");
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState(initialName ?? "");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [devHint, setDevHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function login() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await customerLoginAction(phone, password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAuthenticated();
  }

  async function startSignup() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await customerSignupStartAction(phone);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setChallengeId(String(result.data?.challengeId ?? ""));
    setDevHint(result.data?.devCode ? String(result.data.devCode) : null);
    setSignupStep("otp");
    setMode("signup");
  }

  async function completeSignup() {
    if (pending || !challengeId) return;
    if (password.length < 8) {
      setError("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setPending(true);
    setError(null);
    const result = await customerSignupCompleteAction({
      challengeId,
      code,
      password,
      displayName: displayName.trim() || undefined,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAuthenticated();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[color:var(--store-ink,#0F1724)]/45"
        aria-label="ปิด"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-auth-title"
        className="relative z-[1] max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] bg-[color:var(--store-paper,#F7F4EF)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:rounded-[1.75rem] sm:pb-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10 sm:hidden" aria-hidden />
        <div className="mb-4 flex items-center gap-3">
          <StoreLogo brand={brand} size={40} className="bg-white shadow-sm" />
          <div className="min-w-0">
            <p
              id="booking-auth-title"
              className="truncate text-base font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
            >
              {brand.shortName || brand.businessName}
            </p>
            <p className="text-xs text-muted">เข้าสู่ระบบเพื่อส่งคำขอจอง · ร่างของคุณถูกเก็บไว้แล้ว</p>
          </div>
        </div>

        {mode === "login" ? (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-muted">เบอร์โทร</span>
              <input
                className={INPUT}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-muted">รหัสผ่าน</span>
              <input
                className={INPUT}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button type="button" className={CTA} disabled={pending} onClick={() => void login()}>
              {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบแล้วส่งคำขอ"}
            </button>
            <button
              type="button"
              className="w-full py-2 text-sm font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
              onClick={() => void startSignup()}
              disabled={pending || phone.replace(/\D/g, "").length < 8}
            >
              ยังไม่มีบัญชี? สมัครด้วยเบอร์นี้
            </button>
          </div>
        ) : signupStep === "otp" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              ส่งรหัสไปที่ <span className="font-medium text-[color:var(--store-ink,#0F1724)]">{phone}</span>
            </p>
            <OtpInput value={code} onChange={setCode} autoFocus />
            {devHint ? (
              <p className="rounded-xl bg-white/80 px-3 py-2 text-xs text-muted">รหัสทดสอบ: {devHint}</p>
            ) : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button
              type="button"
              className={CTA}
              disabled={pending || code.length < 6}
              onClick={() => setSignupStep("password")}
            >
              ถัดไป
            </button>
            <button type="button" className="w-full py-2 text-sm text-muted" onClick={() => setMode("login")}>
              กลับไปเข้าสู่ระบบ
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-muted">ชื่อที่แสดง</span>
              <input
                className={INPUT}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-muted">ตั้งรหัสผ่าน</span>
              <input
                className={INPUT}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-muted">ยืนยันรหัสผ่าน</span>
              <input
                className={INPUT}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button type="button" className={CTA} disabled={pending} onClick={() => void completeSignup()}>
              {pending ? "กำลังสร้างบัญชี…" : "สร้างบัญชีแล้วส่งคำขอ"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function BookingAuthSheet({
  brand,
  initialPhone,
  initialName,
  open,
  onClose,
  onAuthenticated,
}: {
  brand: BusinessBranding;
  initialPhone: string;
  initialName?: string;
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  if (!open) return null;
  return (
    <BookingAuthSheetBody
      key={`${initialPhone}|${initialName ?? ""}`}
      brand={brand}
      initialPhone={initialPhone}
      initialName={initialName}
      onClose={onClose}
      onAuthenticated={onAuthenticated}
    />
  );
}
