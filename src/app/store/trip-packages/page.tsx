import Link from "next/link";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import {
  TRIP_PACKAGE_STATUS_LABELS,
  TRIP_PACKAGE_STATUS_TONES,
} from "@/components/store-admin/trip-packages/status";
import { requireStoreContext } from "@/lib/auth/tenant";
import {
  PLAN_UNLOCK_HINT,
  allowsTripPackages,
  planUnlockHref,
} from "@/lib/domain/booking-entitlements";
import {
  TRIP_PACKAGE_STATUSES,
  localizedPackageText,
  packageDurationLabel,
  type TripPackageStatus,
} from "@/lib/domain/trip-package";

export const dynamic = "force-dynamic";

function parseStatus(raw: string | undefined): TripPackageStatus | null {
  return TRIP_PACKAGE_STATUSES.find((status) => status === raw) ?? null;
}

export default async function TripPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; featured?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId || !ctx.business) return <p>บัญชีนี้ยังไม่มีร้าน</p>;

  // Page-level gate: nav hides the link, but the route must refuse too.
  if (!allowsTripPackages(ctx.business.subscriptionPlan)) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="text-2xl font-semibold text-navy-800">แพ็กเกจทริป</h1>
        <div className="rounded-2xl bg-white p-5">
          <p className="text-sm text-navy-800">
            แพ็กเกจปัจจุบันยังไม่รองรับแพ็กเกจทริป
          </p>
          <p className="mt-1 text-sm text-muted">
            {PLAN_UNLOCK_HINT["storefront.tripPackages"]}
          </p>
          <Link
            href={planUnlockHref()}
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950"
          >
            ดูแพ็กเกจและการชำระเงิน
          </Link>
        </div>
      </div>
    );
  }

  const storeSlug = ctx.business.slug;
  const query = await searchParams;
  const status = parseStatus(query.status);
  const search = (query.q ?? "").trim();
  const featuredOnly = query.featured === "1";

  const all = await ctx.store.listTripPackages(ctx.actor, ctx.businessId, {
    includeArchived: true,
  });
  const packages = all.filter((pkg) => {
    if (status ? pkg.status !== status : pkg.status === "ARCHIVED") return false;
    if (featuredOnly && !pkg.featured) return false;
    if (!search) return true;
    const haystack = [pkg.title.th, pkg.title.en, pkg.title.zh, pkg.summary.th]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  function filterHref(next: { status?: string; featured?: string }) {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? (status ?? "");
    const nextFeatured = next.featured ?? (featuredOnly ? "1" : "");
    if (nextStatus) params.set("status", nextStatus);
    if (nextFeatured) params.set("featured", nextFeatured);
    if (search) params.set("q", search);
    const qs = params.toString();
    return qs ? `/store/trip-packages?${qs}` : "/store/trip-packages";
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-800">แพ็กเกจทริป</h1>
          <p className="mt-1 text-sm text-muted">
            แพ็กเกจที่เผยแพร่จะแสดงในหน้าร้านของลูกค้า — ราคาสรุปในใบเสนอราคาเสมอ
          </p>
        </div>
        <Link
          href="/store/trip-packages/new"
          className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold leading-10 text-navy-950"
        >
          + สร้างแพ็กเกจ
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={filterHref({ status: "" })}
          className={`h-10 rounded-full px-3 text-sm leading-10 ${
            !status ? "bg-navy-800 text-white" : "bg-white"
          }`}
        >
          ใช้งานอยู่
        </Link>
        {TRIP_PACKAGE_STATUSES.map((item) => (
          <Link
            key={item}
            href={filterHref({ status: item })}
            className={`h-10 rounded-full px-3 text-sm leading-10 ${
              status === item ? "bg-navy-800 text-white" : "bg-white"
            }`}
          >
            {TRIP_PACKAGE_STATUS_LABELS[item]}
          </Link>
        ))}
        <Link
          href={filterHref({ featured: featuredOnly ? "" : "1" })}
          className={`h-10 rounded-full px-3 text-sm leading-10 ${
            featuredOnly ? "bg-navy-800 text-white" : "bg-white"
          }`}
        >
          แนะนำเท่านั้น
        </Link>
      </div>

      <form action="/store/trip-packages" className="mt-3 flex gap-2">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {featuredOnly ? <input type="hidden" name="featured" value="1" /> : null}
        <input
          name="q"
          defaultValue={search}
          placeholder="ค้นหาชื่อแพ็กเกจ"
          className="admin-input max-w-xs"
        />
        <button className="h-11 rounded-xl bg-white px-4 text-sm text-navy-800">ค้นหา</button>
      </form>

      <div className="mt-4 space-y-3">
        {packages.length === 0 ? (
          <EmptyState
            title="ยังไม่มีแพ็กเกจทริป"
            hint="สร้างแพ็กเกจเพื่อเสนอเส้นทางสำเร็จรูปให้ลูกค้า แล้วค่อยเผยแพร่เมื่อพร้อม"
            actionHref="/store/trip-packages/new"
            actionLabel="+ สร้างแพ็กเกจ"
          />
        ) : null}
        {packages.map((pkg) => {
          const cover = pkg.coverImageUrl ?? pkg.galleryImageUrls[0] ?? null;
          return (
            <article
              key={pkg.id}
              className="flex gap-3 rounded-2xl bg-white p-3 sm:items-center sm:gap-4 sm:p-4"
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl object-cover sm:w-20"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-paper text-[10px] text-muted sm:w-20">
                  ไม่มีรูป
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  {packageDurationLabel("th", pkg.days, pkg.nights)} · ผู้โดยสาร{" "}
                  {pkg.passengerMin}-{pkg.passengerMax}
                  {pkg.featured ? " · แนะนำ" : ""}
                </p>
                <p className="font-semibold text-navy-800">
                  {localizedPackageText("th", pkg.title, "ไม่มีชื่อ")}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                  {localizedPackageText("th", pkg.summary)}
                </p>
                <p className="mt-1 text-xs font-medium">
                  <span className={TRIP_PACKAGE_STATUS_TONES[pkg.status]}>
                    {TRIP_PACKAGE_STATUS_LABELS[pkg.status]}
                  </span>
                  <span className="text-muted">
                    {" · "}
                    {pkg.pricingMode === "QUOTE_FIRST" || pkg.priceAmount == null
                      ? "ขอใบเสนอราคา"
                      : pkg.pricingMode === "FIXED_PRICE"
                        ? `฿${pkg.priceAmount.toLocaleString("th-TH")} / ทริป`
                        : `เริ่มต้น ฿${pkg.priceAmount.toLocaleString("th-TH")}`}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 text-sm">
                <Link
                  href={`/store/trip-packages/${pkg.id}`}
                  className="font-medium text-navy-800"
                >
                  แก้ไข
                </Link>
                {pkg.status === "PUBLISHED" ? (
                  <a
                    href={`/s/${storeSlug}/packages/${pkg.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted"
                  >
                    ดูหน้าร้าน ↗
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
