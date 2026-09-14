import { CustomerAuthForms } from "@/components/account/CustomerAuthForms";
import { isDevOtpEnabled } from "@/lib/auth/otp";
import { resolveCustomerAuthPresentation } from "@/lib/auth/customer-auth-context";

export const dynamic = "force-dynamic";

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; store?: string; context?: string }>;
}) {
  const params = await searchParams;
  const presentation = await resolveCustomerAuthPresentation({
    storeSlug: params.store,
    context: params.context,
    next: params.next,
  });

  return (
    <div style={presentation.cssVars}>
      <CustomerAuthForms presentation={presentation} showDevBadge={isDevOtpEnabled()} />
    </div>
  );
}
