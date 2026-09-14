import Link from "next/link";
import { TripPackageForm } from "@/components/store-admin/trip-packages/TripPackageForm";
import { requireStoreContext } from "@/lib/auth/tenant";
import {
  PLAN_UNLOCK_HINT,
  allowsTripPackages,
  planUnlockHref,
} from "@/lib/domain/booking-entitlements";

export const dynamic = "force-dynamic";

export default async function NewTripPackagePage() {
  const ctx = await requireStoreContext();
  if (!ctx.businessId || !ctx.business) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  if (!allowsTripPackages(ctx.business.subscriptionPlan)) {
    return (
      <div className="max-w-xl space-y-3 rounded-2xl bg-white p-5">
        <p className="text-sm text-navy-800">แพ็กเกจปัจจุบันยังไม่รองรับแพ็กเกจทริป</p>
        <p className="text-sm text-muted">{PLAN_UNLOCK_HINT["storefront.tripPackages"]}</p>
        <Link href={planUnlockHref()} className="text-sm font-semibold text-navy-800 underline">
          ดูแพ็กเกจและการชำระเงิน
        </Link>
      </div>
    );
  }

  const places = await ctx.store.listPlaces(ctx.actor, ctx.businessId);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-navy-800">สร้างแพ็กเกจทริป</h1>
      <TripPackageForm businessId={ctx.businessId} places={places} />
    </div>
  );
}
