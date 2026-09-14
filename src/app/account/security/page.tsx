import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PhoneVerifyForm } from "@/components/account/PhoneVerifyForm";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { isDevOtpEnabled } from "@/lib/auth/otp";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  return (
    <Suspense fallback={<p className="text-sm text-muted">กำลังโหลด...</p>}>
      <PhoneVerifyForm showDevHint={isDevOtpEnabled()} />
    </Suspense>
  );
}
