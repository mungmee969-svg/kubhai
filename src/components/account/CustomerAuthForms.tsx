"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OtpInput } from "@/components/account/OtpInput";
import { BrandMark } from "@/components/brand/BrandMark";
import {
  PoweredByKubHaiSubtle,
  StoreLogo,
} from "@/components/brand/StoreBrand";
import { CustomerPrefsProvider, useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";
import {
  customerForgotCompleteAction,
  customerForgotStartAction,
  customerLoginAction,
  customerSignupCompleteAction,
  customerSignupStartAction,
  customerSocialBeginAction,
  customerSocialCompleteAction,
} from "@/lib/actions/customer-auth";
import type { CustomerAuthPresentation } from "@/lib/auth/customer-auth-context";

type Mode = "login" | "signup" | "forgot";
type SignupStep = "phone" | "otp" | "password";
type ForgotStep = "phone" | "otp" | "password" | "done";

const INPUT =
  "h-11 w-full rounded-[0.9rem] border border-[color:var(--store-line,#E5E7EB)] bg-white/80 px-3.5 text-[0.95rem] outline-none focus:border-[color:var(--store-accent,#C4A35A)] focus:ring-[3px] focus:ring-[color:var(--store-accent,#C4A35A)]/25";
const CTA =
  "h-11 w-full rounded-[0.95rem] bg-[color:var(--store-accent,#C4A35A)] text-[0.95rem] font-semibold text-[#1a1510] disabled:opacity-60";

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  const tail = digits.slice(-4);
  const head = digits.slice(0, Math.max(0, digits.length - 4));
  const maskedHead = head.replace(/\d/g, "X");
  return `${maskedHead}${tail}`.replace(/(.{3})/g, "$1 ").trim();
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.7 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c6.1 0 9.1-4.3 9.1-8.2 0-.6-.1-1-.1-1.4H12z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.5v3.2h2.6V22h3.4z"
      />
    </svg>
  );
}

function AuthLogo({
  presentation,
  size,
}: {
  presentation: CustomerAuthPresentation;
  size: number;
}) {
  if (presentation.kind === "PLATFORM") {
    return <BrandMark size={size} priority className="bg-white" />;
  }
  if (presentation.partnerBrand) {
    return <StoreLogo brand={presentation.partnerBrand} size={size} className="bg-white" />;
  }
  return null;
}

export function CustomerAuthForms({
  presentation,
  showDevBadge = false,
}: {
  presentation: CustomerAuthPresentation;
  showDevBadge?: boolean;
}) {
  const body = (
    <CustomerAuthFormsBody presentation={presentation} showDevBadge={showDevBadge} />
  );
  if (presentation.kind === "PARTNER" && presentation.partnerBrand?.slug) {
    return (
      <CustomerPrefsProvider storeSlug={presentation.partnerBrand.slug}>{body}</CustomerPrefsProvider>
    );
  }
  return body;
}

function CustomerAuthFormsBody({
  presentation,
  showDevBadge = false,
}: {
  presentation: CustomerAuthPresentation;
  showDevBadge?: boolean;
}) {
  const { t } = useCustomerPrefs();
  const nextPath = presentation.returnTo;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [signupStep, setSignupStep] = useState<SignupStep>("phone");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("phone");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [devHint, setDevHint] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setResendSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function armResend(resendAvailableAt?: string) {
    if (resendAvailableAt) {
      const ms = Date.parse(resendAvailableAt) - Date.now();
      setResendSeconds(Math.max(1, Math.ceil(ms / 1000)));
      return;
    }
    setResendSeconds(60);
  }

  function resetFlow(next: Mode) {
    setMode(next);
    setSignupStep("phone");
    setForgotStep("phone");
    setChallengeId(null);
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setDevHint(null);
    setError(null);
    setResendSeconds(0);
  }

  async function finishOk() {
    router.push(nextPath);
    router.refresh();
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await customerLoginAction(phone, password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await finishOk();
  }

  async function onSignupStart(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await customerSignupStartAction(phone);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setChallengeId(String(result.data?.challengeId));
    setDevHint(result.data?.devCode ? String(result.data.devCode) : null);
    if (result.data?.resendAvailableAt) {
      armResend(result.data?.resendAvailableAt ? String(result.data.resendAvailableAt) : undefined);
    }
    setSignupStep("otp");
  }

  async function onSignupOtpContinue(e: React.FormEvent) {
    e.preventDefault();
    if (code.replace(/\D/g, "").length !== 6) {
      setError("กรุณากรอกรหัส OTP 6 หลัก");
      return;
    }
    setError(null);
    setSignupStep("password");
  }

  async function onSignupComplete(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
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
      displayName,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await finishOk();
  }

  async function onForgotStart(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await customerForgotStartAction(phone);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setChallengeId(String(result.data?.challengeId));
    setDevHint(result.data?.devCode ? String(result.data.devCode) : null);
    if (result.data?.resendAvailableAt) {
      armResend(result.data?.resendAvailableAt ? String(result.data.resendAvailableAt) : undefined);
    }
    setForgotStep("otp");
  }

  async function onForgotComplete(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setPending(true);
    setError(null);
    const result = await customerForgotCompleteAction({ challengeId, code, password });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setForgotStep("done");
  }

  async function resendOtp(kind: "signup" | "forgot") {
    if (resendSeconds > 0) return;
    setPending(true);
    setError(null);
    const result =
      kind === "signup"
        ? await customerSignupStartAction(phone)
        : await customerForgotStartAction(phone);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setChallengeId(String(result.data?.challengeId));
    setDevHint(result.data?.devCode ? String(result.data.devCode) : null);
    if (result.data?.resendAvailableAt) {
      armResend(result.data?.resendAvailableAt ? String(result.data.resendAvailableAt) : undefined);
    }
    setCode("");
  }

  async function onSocial(provider: "GOOGLE" | "FACEBOOK") {
    setPending(true);
    setError(null);
    const begun = await customerSocialBeginAction(provider, nextPath);
    if (!begun.ok) {
      setPending(false);
      setError(begun.error);
      return;
    }
    const result = await customerSocialCompleteAction({
      provider,
      mockToken: String(begun.data?.mockToken),
      displayName: provider === "GOOGLE" ? "Google Guest" : "Facebook Guest",
      email: `guest-${provider.toLowerCase()}@test-auth.local`,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.data?.needsPhone) {
      router.push(`/account/security?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    await finishOk();
  }

  const isPlatform = presentation.kind === "PLATFORM";
  const storeName = presentation.displayName;
  const coverUrl = presentation.partnerBrand?.coverUrl ?? null;
  const loginSubtitle =
    mode === "signup" ? presentation.signupSubtitle : presentation.loginSubtitle;

  return (
    <div className="relative min-h-dvh bg-[color:var(--store-paper,#F7F4EF)] text-[color:var(--store-ink,#0F1724)]">
      {showDevBadge ? (
        <div className="absolute right-3 top-3 z-20 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium tracking-wide text-white">
          DEV MODE
        </div>
      ) : null}

      <div className="mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-2">
        {/* Brand panel — desktop / large tablet */}
        <aside className="relative hidden overflow-hidden bg-[color:var(--store-primary,#0F3D3E)] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(252,173,18,0.35),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.12),transparent_40%)]" />
          )}
          <div className="relative space-y-8">
            <AuthLogo presentation={presentation} size={64} />
            <div className="space-y-3">
              <p className="text-sm text-white/70">
                {isPlatform ? "KubHai · ขับให้" : storeName}
              </p>
              <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
                {presentation.heroTitle}
              </h1>
              <p className="max-w-sm text-sm leading-6 text-white/80">{presentation.heroBody}</p>
            </div>
          </div>
          {isPlatform && presentation.poweredByKubHaiEnabled ? (
            <PoweredByKubHaiSubtle
              enabled
              className="relative justify-start text-white/50 [&_span]:text-white/50"
            />
          ) : isPlatform ? (
            <p className="relative text-xs text-white/50">KubHai · ขับให้</p>
          ) : null}
        </aside>

        {/* Auth panel */}
        <section className="flex flex-col px-5 py-6 sm:px-8 lg:justify-center lg:px-12 lg:py-10">
          <div className="mx-auto w-full max-w-md">
            {/* Mobile brand header — single logo */}
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <AuthLogo presentation={presentation} size={44} />
              <div>
                <p className="text-sm font-semibold">
                  {isPlatform ? "KubHai · ขับให้" : storeName}
                </p>
                <p className="text-xs text-muted">{loginSubtitle}</p>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(15,23,36,0.06)] sm:p-7">
              {mode !== "forgot" ? (
                <div
                  className="mb-6 grid grid-cols-2 rounded-full bg-[color:var(--store-paper,#F7F4EF)] p-1 text-sm"
                  role="tablist"
                  aria-label={t("auth.modeAria")}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "login"}
                    onClick={() => resetFlow("login")}
                    className={`rounded-full py-2.5 font-medium transition ${
                      mode === "login"
                        ? "bg-[color:var(--store-primary,#0F3D3E)] text-white shadow-sm"
                        : "text-muted"
                    }`}
                  >
                    {t("auth.loginTitle")}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "signup"}
                    onClick={() => resetFlow("signup")}
                    className={`rounded-full py-2.5 font-medium transition ${
                      mode === "signup"
                        ? "bg-[color:var(--store-primary,#0F3D3E)] text-white shadow-sm"
                        : "text-muted"
                    }`}
                  >
                    {t("auth.signupMember")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="mb-4 text-sm text-muted"
                  onClick={() => resetFlow("login")}
                >
                  {t("auth.backToLogin")}
                </button>
              )}

              {mode === "login" ? (
                <form onSubmit={onLogin} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">{t("auth.loginTitle")}</h2>
                    <p className="mt-1 text-sm text-muted">{presentation.loginSubtitle}</p>
                  </div>
                  <Field label={t("auth.phone")}>
                    <input
                      className="h-11 w-full rounded-[0.9rem] border border-[color:var(--store-line,#E5E7EB)] bg-[color:color-mix(in_srgb,var(--store-paper,#F7F4EF)_65%,white)] px-3.5 text-[0.95rem] outline-none focus:border-[color:var(--store-accent,#C4A35A)] focus:bg-white focus:ring-[3px] focus:ring-[color:color-mix(in_srgb,var(--store-accent,#C4A35A)_25%,transparent)]"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="08X XXX XXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label={t("auth.password")}>
                    <input
                      className="h-11 w-full rounded-[0.9rem] border border-[color:var(--store-line,#E5E7EB)] bg-[color:color-mix(in_srgb,var(--store-paper,#F7F4EF)_65%,white)] px-3.5 text-[0.95rem] outline-none focus:border-[color:var(--store-accent,#C4A35A)] focus:bg-white focus:ring-[3px] focus:ring-[color:color-mix(in_srgb,var(--store-accent,#C4A35A)_25%,transparent)]"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Field>
                  <button
                    type="button"
                    className="-mt-2 text-left text-xs font-medium text-[color:var(--store-primary,#0F3D3E)]"
                    onClick={() => resetFlow("forgot")}
                  >
                    {t("auth.forgotLink")}
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="h-11 w-full rounded-[0.95rem] bg-[color:var(--store-accent,#C4A35A)] text-[0.95rem] font-semibold text-[#1a1510] disabled:opacity-60"
                  >
                    {pending ? t("auth.loggingIn") : t("auth.loginTitle")}
                  </button>
                  <Divider />
                  <SocialButtons pending={pending} onSocial={onSocial} />
                </form>
              ) : null}

              {mode === "signup" && signupStep === "phone" ? (
                <form onSubmit={onSignupStart} className="space-y-4">
                  <StepHeader
                    title="สมัครสมาชิก"
                    step="ขั้นตอน 1 จาก 3"
                    subtitle={presentation.signupSubtitle}
                  />
                  <Field label="เบอร์โทรศัพท์">
                    <input
                      className={INPUT}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="08X XXX XXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </Field>
                  <button type="submit" disabled={pending} className={CTA}>
                    รับรหัส OTP
                  </button>
                </form>
              ) : null}

              {mode === "signup" && signupStep === "otp" ? (
                <form onSubmit={onSignupOtpContinue} className="space-y-4">
                  <StepHeader title="ยืนยันเบอร์โทร" step="ขั้นตอน 2 จาก 3" />
                  <p className="text-sm text-muted">
                    ส่งรหัสไปที่ <span className="font-medium text-[color:var(--store-ink,#0F1724)]">{maskPhone(phone)}</span>
                  </p>
                  {devHint ? <DevOtpHint code={devHint} /> : null}
                  <OtpInput value={code} onChange={setCode} autoFocus />
                  <button type="submit" disabled={pending || code.length < 6} className={CTA}>
                    {t("common.next")}
                  </button>
                  <button
                    type="button"
                    disabled={pending || resendSeconds > 0}
                    onClick={() => void resendOtp("signup")}
                    className="w-full text-center text-sm text-muted disabled:opacity-50"
                  >
                    {resendSeconds > 0 ? `ส่งรหัสอีกครั้งได้ใน ${resendSeconds}s` : "ส่งรหัสอีกครั้ง"}
                  </button>
                </form>
              ) : null}

              {mode === "signup" && signupStep === "password" ? (
                <form onSubmit={onSignupComplete} className="space-y-4">
                  <StepHeader title="ตั้งรหัสผ่าน" step="ขั้นตอน 3 จาก 3" />
                  <Field label="ชื่อที่แสดง (ถ้ามี)">
                    <input
                      className={INPUT}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="ชื่อของคุณ"
                    />
                  </Field>
                  <Field label="รหัสผ่าน">
                    <input
                      className={INPUT}
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="ยืนยันรหัสผ่าน">
                    <input
                      className={INPUT}
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </Field>
                  <button type="submit" disabled={pending} className={CTA}>
                    สร้างบัญชี
                  </button>
                </form>
              ) : null}

              {mode === "forgot" && forgotStep === "phone" ? (
                <form onSubmit={onForgotStart} className="space-y-4">
                  <StepHeader title="ลืมรหัสผ่าน" subtitle="เราจะส่งรหัส OTP ไปยังเบอร์ของคุณ" />
                  <Field label="เบอร์โทรศัพท์">
                    <input
                      className={INPUT}
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </Field>
                  <button type="submit" disabled={pending} className={CTA}>
                    รับรหัส OTP
                  </button>
                </form>
              ) : null}

              {mode === "forgot" && forgotStep === "otp" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code.length < 6) {
                      setError("กรุณากรอกรหัส OTP 6 หลัก");
                      return;
                    }
                    setForgotStep("password");
                  }}
                  className="space-y-4"
                >
                  <StepHeader title="ยืนยันรหัส OTP" />
                  <p className="text-sm text-muted">
                    ส่งรหัสไปที่ <span className="font-medium">{maskPhone(phone)}</span>
                  </p>
                  {devHint ? <DevOtpHint code={devHint} /> : null}
                  <OtpInput value={code} onChange={setCode} autoFocus />
                  <button type="submit" disabled={code.length < 6} className={CTA}>
                    {t("common.next")}
                  </button>
                  <button
                    type="button"
                    disabled={pending || resendSeconds > 0}
                    onClick={() => void resendOtp("forgot")}
                    className="w-full text-center text-sm text-muted disabled:opacity-50"
                  >
                    {resendSeconds > 0 ? `ส่งรหัสอีกครั้งได้ใน ${resendSeconds}s` : "ส่งรหัสอีกครั้ง"}
                  </button>
                </form>
              ) : null}

              {mode === "forgot" && forgotStep === "password" ? (
                <form onSubmit={onForgotComplete} className="space-y-4">
                  <StepHeader title="ตั้งรหัสผ่านใหม่" />
                  <Field label="รหัสผ่านใหม่">
                    <input
                      className={INPUT}
                      type="password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="ยืนยันรหัสผ่าน">
                    <input
                      className={INPUT}
                      type="password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </Field>
                  <button type="submit" disabled={pending} className={CTA}>
                    บันทึกรหัสผ่าน
                  </button>
                </form>
              ) : null}

              {mode === "forgot" && forgotStep === "done" ? (
                <div className="space-y-4 text-center">
                  <p className="text-lg font-semibold">ตั้งรหัสผ่านใหม่สำเร็จ</p>
                  <p className="text-sm text-muted">เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย</p>
                  <button type="button" className={CTA} onClick={() => resetFlow("login")}>
                    {t("auth.loginTitle")}
                  </button>
                </div>
              ) : null}

              {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
            </div>

            <div className="mt-6 flex flex-col items-center gap-3 text-center">
              <Link
                href={presentation.backHref}
                className="text-sm text-muted hover:text-[color:var(--store-ink,#0F1724)]"
              >
                {presentation.backLabel}
              </Link>
              {isPlatform && presentation.poweredByKubHaiEnabled ? (
                <div className="lg:hidden">
                  <PoweredByKubHaiSubtle enabled />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function StepHeader({
  title,
  step,
  subtitle,
}: {
  title: string;
  step?: string;
  subtitle?: string;
}) {
  return (
    <div>
      {step ? <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{step}</p> : null}
      <h2 className="text-xl font-semibold">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
}

function Divider() {
  const { t } = useCustomerPrefs();
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-[color:var(--store-line,#E5E7EB)]" />
      {t("auth.or")}
      <span className="h-px flex-1 bg-[color:var(--store-line,#E5E7EB)]" />
    </div>
  );
}

function SocialButtons({
  pending,
  onSocial,
}: {
  pending: boolean;
  onSocial: (provider: "GOOGLE" | "FACEBOOK") => void;
}) {
  const { t } = useCustomerPrefs();
  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => onSocial("GOOGLE")}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--store-line,#E5E7EB)] bg-white text-sm font-medium disabled:opacity-60"
      >
        <GoogleIcon />
        {t("auth.google")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => onSocial("FACEBOOK")}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--store-line,#E5E7EB)] bg-white text-sm font-medium disabled:opacity-60"
      >
        <FacebookIcon />
        {t("auth.facebook")}
      </button>
    </div>
  );
}

function DevOtpHint({ code }: { code: string }) {
  return (
    <p className="rounded-lg border border-dashed border-black/15 bg-black/[0.03] px-3 py-2 text-[11px] text-muted">
      DEV TEST · OTP: <span className="font-mono font-semibold tracking-wider text-[color:var(--store-ink,#0F1724)]">{code}</span>
    </p>
  );
}
