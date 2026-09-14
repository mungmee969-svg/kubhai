"use server";

import { revalidatePath } from "next/cache";
import {
  clearCustomerSession,
  setCustomerSession,
  getCustomerSession,
} from "@/lib/auth/customer-session";
import { DomainError, TenantIsolationError, getStore } from "@/lib/data";
import type { SocialProvider } from "@/lib/auth/oauth";
import { isPhoneVerified, normalizePhone } from "@/lib/domain/customer-auth";

export type CustomerAuthResult =
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; error: string };

async function sessionFromAccount(account: {
  id: string;
  phone: string | null;
  phoneVerifiedAt: string | null;
  displayName: string | null;
}) {
  await setCustomerSession({
    customerAccountId: account.id,
    phone: account.phone,
    phoneVerified: Boolean(account.phoneVerifiedAt),
    displayName: account.displayName,
  });
}

export async function customerSignupStartAction(phone: string): Promise<CustomerAuthResult> {
  try {
    const result = await getStore().startCustomerSignup(phone);
    return {
      ok: true,
      data: {
        challengeId: result.challengeId,
        expiresAt: result.expiresAt,
        resendAvailableAt: result.resendAvailableAt,
        // Dev only — never present in production without explicit flag
        ...(result.devCode ? { devCode: result.devCode } : {}),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof DomainError ? error.message : "ขอรหัสไม่สำเร็จ" };
  }
}

export async function customerSignupCompleteAction(input: {
  challengeId: string;
  code: string;
  password: string;
  displayName?: string;
}): Promise<CustomerAuthResult> {
  try {
    const account = await getStore().completeCustomerSignup(input);
    await sessionFromAccount(account);
    return { ok: true, data: { customerAccountId: account.id } };
  } catch (error) {
    return { ok: false, error: error instanceof DomainError ? error.message : "สมัครไม่สำเร็จ" };
  }
}

export async function customerLoginAction(phone: string, password: string): Promise<CustomerAuthResult> {
  try {
    const account = await getStore().loginCustomerWithPassword(phone, password);
    if (!account) return { ok: false, error: "เบอร์หรือรหัสผ่านไม่ถูกต้อง" };
    await sessionFromAccount(account);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof DomainError ? error.message : "เข้าสู่ระบบไม่สำเร็จ" };
  }
}

export async function customerLogoutAction(): Promise<void> {
  await clearCustomerSession();
  revalidatePath("/account");
}

export async function customerForgotStartAction(phone: string): Promise<CustomerAuthResult> {
  try {
    const result = await getStore().startForgotPassword(phone);
    return {
      ok: true,
      data: {
        challengeId: result.challengeId,
        resendAvailableAt: result.resendAvailableAt,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof DomainError ? error.message : "ขอรหัสไม่สำเร็จ" };
  }
}

export async function customerForgotCompleteAction(input: {
  challengeId: string;
  code: string;
  password: string;
}): Promise<CustomerAuthResult> {
  try {
    const account = await getStore().completeForgotPassword(input);
    await sessionFromAccount(account);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof DomainError ? error.message : "ตั้งรหัสผ่านใหม่ไม่สำเร็จ" };
  }
}

export async function customerSocialBeginAction(
  provider: SocialProvider,
  returnTo: string,
): Promise<CustomerAuthResult> {
  try {
    const begun = await getStore().beginSocialLogin(provider, returnTo);
    return { ok: true, data: begun as unknown as Record<string, unknown> };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Social login ยังไม่พร้อม",
    };
  }
}

export async function customerSocialCompleteAction(input: {
  provider: SocialProvider;
  mockToken: string;
  email?: string;
  displayName?: string;
}): Promise<CustomerAuthResult> {
  try {
    const account = await getStore().completeSocialLogin(input);
    await sessionFromAccount(account);
    return {
      ok: true,
      data: {
        customerAccountId: account.id,
        phoneVerified: isPhoneVerified(account),
        needsPhone: !isPhoneVerified(account),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ" };
  }
}

export async function customerRequestPhoneOtpAction(phone: string): Promise<CustomerAuthResult> {
  try {
    const session = await getCustomerSession();
    if (!session) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
    const result = await getStore().requestCustomerOtp({
      phone: normalizePhone(phone),
      purpose: "BOOKING_VERIFY",
      customerAccountId: session.customerAccountId,
    });
    return {
      ok: true,
      data: {
        challengeId: result.challengeId,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof DomainError ? error.message : "ขอรหัสไม่สำเร็จ" };
  }
}

export async function customerVerifyPhoneAction(input: {
  challengeId: string;
  code: string;
}): Promise<CustomerAuthResult> {
  try {
    const session = await getCustomerSession();
    if (!session) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
    const account = await getStore().verifyPhoneForAccount({
      customerAccountId: session.customerAccountId,
      ...input,
    });
    await sessionFromAccount(account);
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof DomainError ? error.message : "ยืนยันเบอร์ไม่สำเร็จ" };
  }
}

export async function claimBookingTokenAction(token: string): Promise<CustomerAuthResult> {
  try {
    const session = await getCustomerSession();
    if (!session) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
    if (!session.phoneVerified) return { ok: false, error: "ยืนยันเบอร์โทรเพื่อเชื่อมการจอง" };
    const booking = await getStore().claimBookingByToken(session.customerAccountId, token);
    revalidatePath("/account");
    revalidatePath(`/booking/${token}`);
    return { ok: true, data: { bookingId: booking.id } };
  } catch (error) {
    if (error instanceof TenantIsolationError || error instanceof DomainError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "เชื่อมการจองไม่สำเร็จ" };
  }
}
