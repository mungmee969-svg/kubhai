import { notFound } from "next/navigation";
import { InviteAcceptForm } from "@/components/store-admin/InviteAcceptForm";
import {
  PoweredByKubHaiSubtle,
  StoreBrandScope,
  StoreLogo,
} from "@/components/brand/StoreBrand";
import { getStore } from "@/lib/data";
import { resolveBusinessBranding } from "@/lib/domain/branding";
import { STORE_STAFF_ROLE_LABEL } from "@/lib/domain/staff-permissions";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 20) notFound();
  const raw = await getStore().getStaffInviteByToken(token);
  if (!raw) notFound();
  const brand = resolveBusinessBranding(raw.business);

  return (
    <StoreBrandScope brand={brand} className="min-h-dvh bg-store-paper">
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <StoreLogo brand={brand} size={48} className="bg-white" />
            <div>
              <p className="text-sm font-semibold">{brand.businessName}</p>
              <p className="text-xs text-muted">คำเชิญเข้าทีม</p>
            </div>
          </div>
          <h1 className="mt-6 text-xl font-semibold text-[color:var(--store-ink,#0F1724)]">
            คุณได้รับคำเชิญให้เข้าร่วมทีม
          </h1>
          <p className="mt-2 text-sm text-muted">
            บทบาท: {STORE_STAFF_ROLE_LABEL[raw.invitation.staffRole]}
          </p>
          <div className="mt-6">
            <InviteAcceptForm
              token={token}
              defaultName={raw.invitation.fullName}
              email={raw.invitation.email}
            />
          </div>
        </div>
        <PoweredByKubHaiSubtle enabled={brand.poweredByKubHaiEnabled} className="mt-6" />
      </main>
    </StoreBrandScope>
  );
}
