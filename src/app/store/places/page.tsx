import Link from "next/link";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { ActiveToggle } from "@/components/store-admin/ui/ActiveToggle";
import { PLACE_CATEGORIES, PLACE_CATEGORY_LABELS } from "@/lib/domain/enums";
import { requireStoreContext } from "@/lib/auth/tenant";
import { resolvePlaceImageUrl } from "@/lib/domain/place-image";

export const dynamic = "force-dynamic";

/** Authoritative admin category chips — same taxonomy as customer เที่ยวแนะนำ. */
const PRIMARY = ["ATTRACTION", "RESTAURANT", "LOCAL_FOOD", "CAFE", "HOTEL", "ACTIVITY", "SOUVENIR"] as const;

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId || !ctx.business) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const category = (await searchParams).category ?? "";
  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const places = board.places.filter((item) => (category ? item.category === category : true));
  const provinceName =
    (await ctx.store.getPublicStore(ctx.business.slug))?.province?.nameTh ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-800">ทริป / สถานที่</h1>
          <p className="mt-1 text-sm text-muted">
            แหล่งข้อมูลสำหรับหน้าลูกค้า «เที่ยวแนะนำ» — ไม่ซ้ำกับระบบจอง
          </p>
        </div>
        <Link
          href="/store/places/new"
          className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold leading-10 text-navy-950"
        >
          + เพิ่มสถานที่
        </Link>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Link
          href="/store/places"
          className={`h-10 shrink-0 rounded-full px-3 leading-10 text-sm ${!category ? "bg-navy-800 text-white" : "bg-white"}`}
        >
          ทั้งหมด
        </Link>
        {PRIMARY.map((key) => (
          <Link
            key={key}
            href={`/store/places?category=${key}`}
            className={`h-10 shrink-0 rounded-full px-3 leading-10 text-sm ${category === key ? "bg-navy-800 text-white" : "bg-white"}`}
          >
            {PLACE_CATEGORY_LABELS[key]}
          </Link>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {places.length === 0 ? (
          <EmptyState title="ยังไม่มีสถานที่" actionHref="/store/places/new" actionLabel="+ เพิ่มสถานที่" />
        ) : null}
        {places.map((place) => {
          const hasImage = Boolean(place.imageUrls[0] || place.coverImageUrl);
          const cover = hasImage ? resolvePlaceImageUrl(place) : null;
          return (
            <article
              key={place.id}
              className="flex gap-3 rounded-2xl bg-white p-3 sm:items-center sm:gap-4 sm:p-4"
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-16 sm:w-20" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-paper text-[10px] text-muted sm:w-20">
                  ไม่มีรูป
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{PLACE_CATEGORY_LABELS[place.category]}</p>
                <p className="font-semibold text-navy-800">{place.name}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                  {[place.area, provinceName, place.businessId ? "ของร้าน" : "สถานที่จังหวัด"]
                    .filter(Boolean)
                    .join(" · ")}
                  {place.localRecommended ? " · คนพื้นที่แนะนำ" : ""}
                </p>
                <p className="mt-1 text-xs font-medium">
                  {place.status === "ACTIVE" ? (
                    <span className="text-success">แสดงลูกค้า</span>
                  ) : (
                    <span className="text-muted">ซ่อน / ปิดใช้งาน</span>
                  )}
                </p>
              </div>
              {place.businessId ? (
                <div className="flex shrink-0 flex-col items-end gap-2 text-sm sm:flex-row sm:items-center sm:gap-3">
                  <Link href={`/store/places/${place.id}`} className="font-medium text-navy-800">
                    แก้ไข
                  </Link>
                  <ActiveToggle kind="place" id={place.id} active={place.status === "ACTIVE"} />
                </div>
              ) : (
                <span className="shrink-0 text-xs text-muted">อ่านอย่างเดียว</span>
              )}
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">ยังไม่เปิดระบบโฆษณา / สปอนเซอร์</p>
      <p className="sr-only">{PLACE_CATEGORIES.join(" ")}</p>
    </div>
  );
}
