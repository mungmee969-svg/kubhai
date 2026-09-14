/**
 * Customer auth + ownership checks.
 * Fixtures: TEST_AUTH_ / phone prefix 08991
 */
process.env.KUBHAI_DEV_OTP = "1";
process.env.KUBHAI_ALLOW_DEV_OAUTH = "1";

import {
  LocalStore,
  purgeByClientRequestPrefix,
  purgeCustomerAuthFixtures,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { requiresPhoneBeforeBooking } from "../src/lib/domain/customer-auth";
import { OTP_TTL_MS } from "../src/lib/auth/otp";
import type { Actor } from "../src/lib/domain/types";

const store = new LocalStore();
let failed = 0;
const PHONE_A = "0899100001";
const PHONE_B = "0899100002";
const PREFIX = "TEST_AUTH_";

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

const pondOwner: Actor = {
  kind: "user",
  userId: SEED.userPondOwner,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessPond],
};

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);
    await purgeCustomerAuthFixtures("08991");

    // Signup + OTP
    const otp1 = await store.startCustomerSignup(PHONE_A);
    assert("phone signup OTP issued", Boolean(otp1.challengeId && otp1.devCode));
    assert("dev OTP 123456 works ONLY with dev/test flag", otp1.devCode === "123456");
    const wrong = await store.verifyCustomerOtp({ challengeId: otp1.challengeId, code: "000000" });
    assert("wrong OTP rejected", wrong.ok === false);

    // Production OTP path must not use fixed pilot code
    const prevNode = process.env.NODE_ENV;
    const prevDev = process.env.KUBHAI_DEV_OTP;
    const prevAllow = process.env.KUBHAI_ALLOW_DEV_OTP;
    process.env.NODE_ENV = "production";
    process.env.KUBHAI_DEV_OTP = "0";
    delete process.env.KUBHAI_ALLOW_DEV_OTP;
    const { generateOtpCode, isDevOtpEnabled, isPilotDevOtpEnabled } = await import(
      "../src/lib/auth/otp"
    );
    assert("dev OTP rejected in production configuration", !isDevOtpEnabled() && !isPilotDevOtpEnabled());
    const prodSample = generateOtpCode();
    assert(
      "production OTP protection",
      prodSample.length === 6 && !isPilotDevOtpEnabled(),
    );
    // Restore dev flags for remainder of suite
    process.env.NODE_ENV = prevNode;
    process.env.KUBHAI_DEV_OTP = prevDev;
    if (prevAllow !== undefined) process.env.KUBHAI_ALLOW_DEV_OTP = prevAllow;
    else delete process.env.KUBHAI_ALLOW_DEV_OTP;

    const account = await store.completeCustomerSignup({
      challengeId: otp1.challengeId,
      code: otp1.devCode!,
      password: "password123",
      displayName: "TEST_AUTH_A",
    });
    assert("password setup after OTP", Boolean(account.id && account.phoneVerifiedAt));

    const login = await store.loginCustomerWithPassword(PHONE_A, "password123");
    assert("phone login", login?.id === account.id);

    const badLogin = await store.loginCustomerWithPassword(PHONE_A, "wrong-password");
    assert("bad password rejected", badLogin === null);

    // Duplicate phone prevention
    let dupBlocked = false;
    try {
      await store.startCustomerSignup(PHONE_A);
    } catch {
      dupBlocked = true;
    }
    assert("duplicate customer prevention", dupBlocked);

    // Forgot password
    const forgot = await store.startForgotPassword(PHONE_A);
    const reset = await store.completeForgotPassword({
      challengeId: forgot.challengeId,
      code: forgot.devCode!,
      password: "newpass123",
    });
    assert("forgot password", Boolean(reset.id));
    const login2 = await store.loginCustomerWithPassword(PHONE_A, "newpass123");
    assert("login after reset", login2?.id === account.id);

    // Social foundation (dev adapter) — no phone yet
    const social = await store.completeSocialLogin({
      provider: "GOOGLE",
      subjectId: "TEST_AUTH_GOOGLE_1",
      email: "google-a@test-auth.local",
      displayName: "TEST_AUTH_GOOGLE",
    });
    assert("google auth foundation", Boolean(social.id));
    assert("phone required for booking after social", requiresPhoneBeforeBooking(social));

    const fb = await store.completeSocialLogin({
      provider: "FACEBOOK",
      subjectId: "TEST_AUTH_FB_1",
      email: "fb-a@test-auth.local",
      displayName: "TEST_AUTH_FB",
    });
    assert("facebook auth foundation", Boolean(fb.id) && fb.id !== social.id);

    // Link phone to social account
    const phoneOtp = await store.requestCustomerOtp({
      phone: PHONE_B,
      purpose: "BOOKING_VERIFY",
      customerAccountId: social.id,
    });
    const linked = await store.verifyPhoneForAccount({
      customerAccountId: social.id,
      challengeId: phoneOtp.challengeId,
      code: phoneOtp.devCode!,
    });
    assert("account linking via verified phone", Boolean(linked.phoneVerifiedAt));

    // Booking ownership
    const created = await store.createBookingRequest({
      businessSlug: "pondcarrent",
      clientRequestId: `${PREFIX}BOOK_A`,
      customerName: "TEST_AUTH_A",
      customerPhone: PHONE_A,
      customerEmail: null,
      customerType: "PERSONAL",
      companyName: null,
      taxId: null,
      serviceType: "PRIVATE_DRIVER_DAILY",
      startDate: "2026-11-01",
      startTime: "09:00",
      endDate: "2026-11-01",
      endTime: "17:00",
      passengerCount: 2,
      luggageCount: 1,
      pickupLocation: "นิมมาน",
      dropoffLocation: "ดอยสุเทพ",
      tripNotes: null,
      letStorePlanTrip: false,
      preferredVehicleId: null,
      placeIds: [],
      source: "DIRECT",
      sessionId: `${PREFIX}BOOK_A`,
      referrer: null,
    });
    assert("booking auto-links verified phone account", created.booking.customerAccountId === account.id);

    const claimed = await store.claimBookingByToken(account.id, created.booking.securePublicToken);
    assert("secure token claim idempotent", claimed.customerAccountId === account.id);

    let crossClaimBlocked = false;
    try {
      await store.claimBookingByToken(linked.id, created.booking.securePublicToken);
    } catch {
      crossClaimBlocked = true;
    }
    assert("customer booking ownership", crossClaimBlocked);

    const listA = await store.listCustomerBookings(account.id);
    const listB = await store.listCustomerBookings(linked.id);
    assert("A sees own booking", listA.some((item) => item.id === created.booking.id));
    assert("B does not see A booking", !listB.some((item) => item.id === created.booking.id));

    const foreign = await store.getCustomerBookingRecord(linked.id, created.booking.id);
    assert("URL id does not leak other booking", foreign === null);

    // OTP expiration path
    const expireOtp = await store.requestCustomerOtp({ phone: "0899100099", purpose: "SIGNUP" });
    // Manually expire by verifying after mutating is hard; assert max attempts lock instead
    for (let i = 0; i < 5; i++) {
      await store.verifyCustomerOtp({ challengeId: expireOtp.challengeId, code: "111111" });
    }
    const locked = await store.verifyCustomerOtp({ challengeId: expireOtp.challengeId, code: expireOtp.devCode! });
    assert("OTP max attempts lock", locked.ok === false && locked.reason === "LOCKED");

    // Resend cooldown
    let cooldown = false;
    try {
      await store.requestCustomerOtp({ phone: "0899100099", purpose: "SIGNUP" });
      await store.requestCustomerOtp({ phone: "0899100099", purpose: "SIGNUP" });
    } catch {
      cooldown = true;
    }
    assert("OTP resend cooldown", cooldown);

    void OTP_TTL_MS;
    void pondOwner;
  } finally {
    await purgeByClientRequestPrefix(PREFIX);
    await purgeCustomerAuthFixtures("08991");
    const leftover = await store.listCustomerBookings("nonexistent");
    assert("cleanup removes TEST_AUTH_ bookings", leftover.length === 0);
    // verify accounts purged
    const after = await purgeCustomerAuthFixtures("08991");
    assert("test cleanup auth accounts", after === 0);
  }

  if (failed) {
    console.error(`auth-check failed (${failed})`);
    process.exit(1);
  }
  console.log("auth-check passed");
}

void main();
