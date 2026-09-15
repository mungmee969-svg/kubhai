import {
  LocalStore,
  purgeTestMerchants,
} from "../src/lib/data/local-store";
import type { Actor } from "../src/lib/domain/types";
import { SEED } from "../src/lib/data/seed-ids";

const EMAIL_PREFIX = "test-saas-billing-";
let failed = 0;

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

async function main() {
  await purgeTestMerchants(EMAIL_PREFIX);
  const store = new LocalStore();
  const key = crypto.randomUUID();
  const email = `${EMAIL_PREFIX}${Date.now()}@example.test`;
  const input = {
    idempotencyKey: key,
    email,
    password: "secure-test-password",
    ownerName: "Test SaaS Owner",
    storeName: "Test SaaS Store",
    storeSlug: `test-saas-${Date.now()}`,
    planId: "pro" as const,
  };

  try {
    const first = await store.provisionMerchant(input);
    const retry = await store.provisionMerchant(input);
    assert("provision creates workspace once", !first.reused && retry.reused);
    assert("provision retry returns same business", first.business.id === retry.business.id);
    assert("subscription not duplicated", first.subscription.id === retry.subscription.id);
    assert("new subscription is not fake-paid", first.subscription.status === "PENDING_PAYMENT");
    assert("selected plan comes from catalog", first.subscription.planId === "pro");

    const login = await store.authenticate(email, input.password);
    assert("new merchant uses existing Store auth", login?.profile.id === first.profile.id);
    assert(
      "owner membership unique",
      login?.businessIds.length === 1 && login.businessIds[0] === first.business.id,
    );

    const owner: Actor = {
      kind: "user",
      userId: first.profile.id,
      role: "BUSINESS_OWNER",
      businessIds: [first.business.id],
    };
    const superAdmin: Actor = {
      kind: "user",
      userId: SEED.userSuper,
      role: "SUPER_ADMIN",
      businessIds: [],
    };
    const beforeDashboard = await store.getPlatformSaasDashboard(superAdmin);
    const account = await store.getSaasBillingAccount(owner, first.business.id);
    assert("initial bill created", account.billingPeriods.length === 1);
    const bill = account.billingPeriods[0];
    assert(
      "historical plan price snapshotted",
      bill.planIdSnapshot === "pro" &&
        bill.planNameSnapshot === "Pro" &&
        bill.amountThb === 999 &&
        bill.currency === "THB",
    );
    assert(
      "bill has authoritative period and due date",
      Boolean(bill.periodStart && bill.periodEnd && bill.dueAt),
    );

    const unauthorizedStaff: Actor = {
      kind: "user",
      userId: crypto.randomUUID(),
      role: "BUSINESS_STAFF",
      businessIds: [first.business.id],
    };
    let staffBlocked = false;
    try {
      await store.getSaasBillingAccount(unauthorizedStaff, first.business.id);
    } catch {
      staffBlocked = true;
    }
    assert("unauthorized staff blocked from SaaS billing", staffBlocked);

    const proof1 = await store.submitSaasPaymentProof(owner, {
      businessId: first.business.id,
      billingPeriodId: bill.id,
      submittedAmountThb: 999,
      originalFileName: "proof.png",
      mime: "image/png",
      imageDataUrl: "data:image/png;base64,dGVzdC1zYWFzLXByb29mLTE=",
    });
    assert("SaaS proof awaits platform review", proof1.status === "AWAITING_REVIEW");

    let tenantReviewBlocked = false;
    try {
      await store.reviewSaasPaymentProof(owner, proof1.id, { decision: "APPROVE" });
    } catch {
      tenantReviewBlocked = true;
    }
    assert("Store Owner cannot perform platform review", tenantReviewBlocked);

    const rejected = await store.reviewSaasPaymentProof(superAdmin, proof1.id, {
      decision: "REJECT",
      reason: "ยอด/หลักฐานไม่ชัดเจน",
    });
    assert(
      "rejection records reason and remains unpaid",
      rejected.proof.status === "REJECTED" &&
        rejected.proof.rejectionReason === "ยอด/หลักฐานไม่ชัดเจน" &&
        rejected.payment === null,
    );

    const proof2 = await store.submitSaasPaymentProof(owner, {
      businessId: first.business.id,
      billingPeriodId: bill.id,
      submittedAmountThb: 999,
      originalFileName: "proof-resubmit.png",
      mime: "image/png",
      imageDataUrl: "data:image/png;base64,dGVzdC1zYWFzLXByb29mLTI=",
    });
    const approved = await store.reviewSaasPaymentProof(superAdmin, proof2.id, {
      decision: "APPROVE",
    });
    const periodEnd = approved
      ? (await store.getSaasBillingAccount(owner, first.business.id)).subscription
          ?.currentPeriodEnd
      : null;
    const repeated = await store.reviewSaasPaymentProof(superAdmin, proof2.id, {
      decision: "APPROVE",
    });
    const finalAccount = await store.getSaasBillingAccount(owner, first.business.id);
    assert(
      "approval creates exactly one SaaS payment",
      finalAccount.payments.length === 1 && approved.payment?.amountThb === 999,
    );
    assert(
      "repeated approval is idempotent",
      repeated.reused &&
        finalAccount.subscription?.currentPeriodEnd === periodEnd &&
        finalAccount.payments.length === 1,
    );
    assert("approved subscription becomes active", finalAccount.subscription?.status === "ACTIVE");

    let crossTenantBlocked = false;
    const pondOwner: Actor = {
      kind: "user",
      userId: SEED.userPondOwner,
      role: "BUSINESS_OWNER",
      businessIds: [SEED.businessPond],
    };
    try {
      await store.getSaasBillingAccount(pondOwner, first.business.id);
    } catch {
      crossTenantBlocked = true;
    }
    assert("Store A cannot read Store B SaaS billing", crossTenantBlocked);

    const afterDashboard = await store.getPlatformSaasDashboard(superAdmin);
    assert(
      "SaaS revenue uses SaaS ledger only",
      afterDashboard.revenueThisMonthThb - beforeDashboard.revenueThisMonthThb === 999,
    );

    await store.updateSaasSubscription(superAdmin, first.subscription.id, {
      status: "PAST_DUE",
      reason: "test explicit overdue state",
    });
    const audited = await store.getSaasBillingAccount(superAdmin, first.business.id);
    assert(
      "manual subscription change audited",
      audited.auditLogs.some((item) => item.action === "SAAS_SUBSCRIPTION_MANUAL_CHANGE"),
    );
  } finally {
    await purgeTestMerchants(EMAIL_PREFIX);
  }

  if (failed) {
    console.error(`\nsaas-billing-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nsaas-billing-check: all passed");
}

main().catch(async (error) => {
  console.error(error);
  await purgeTestMerchants(EMAIL_PREFIX);
  process.exit(1);
});
