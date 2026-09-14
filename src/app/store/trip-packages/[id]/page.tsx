import Link from "next/link";
import { notFound } from "next/navigation";
import { TripPackageForm } from "@/components/store-admin/trip-packages/TripPackageForm";
import { requireStoreContext } from "@/lib/auth/tenant";
import {
  PLAN_UNLOCK_HINT,
  allowsTripPackages,
  planUnlockHref,
} from "@/lib/domain/booking-entitlements";
import { localizedPackageText } from "@/lib/domain/trip-package";

export const dynamic = "force-dynamic";

export default async function EditTripPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;
  // Actor-scoped read: returns null for another tenant's package.
  const pkg = await ctx.store.getTripPackage(ctx.actor, id);
  if (!pkg || pkg.businessId !== ctx.businessId) notFound();
  const places = await ctx.store.listPlaces(ctx.actor, ctx.businessId);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-navy-800">
          {localizedPackageText("th", pkg.title, "แก้ไขแพ็กเกจทริป")}
        </h1>
        <p className="mt-1 text-sm text-muted">แก้ไขแพ็กเกจทริป</p>
      </div>
      <TripPackageForm businessId={ctx.businessId} pkg={pkg} places={places} />
    </div>
  );
}
