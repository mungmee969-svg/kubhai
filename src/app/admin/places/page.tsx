import Link from "next/link";
import { PlatformAdminShell } from "@/components/admin/PlatformAdminShell";
import { reviewPlatformPlaceAction } from "@/lib/actions/place-moderation";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { PLACE_CATEGORY_LABELS } from "@/lib/domain/enums";
import { resolvePlaceImageUrl } from "@/lib/domain/place-image";
import type { PlacePlatformModerationStatus } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const TAB_OPTIONS = [
  { value: "pending", label: "รอตรวจสอบ", status: "PENDING_REVIEW" },
  { value: "approved", label: "อนุมัติแล้ว", status: "APPROVED" },
  { value: "rejected", label: "ไม่ผ่าน", status: "REJECTED" },
  { value: "all", label: "ทั้งหมด", status: null },
] as const;

const STATUS_LABEL: Record<PlacePlatformModerationStatus, string> = {
  NOT_SUBMITTED: "ยังไม่ได้เสนอ",
  PENDING_REVIEW: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่ผ่านการอนุมัติ",
};

export default async function PlatformPlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requirePlatformAdmin();
  const tab = (await searchParams).tab ?? "pending";
  const selected =
    TAB_OPTIONS.find((item) => item.value === tab) ?? TAB_OPTIONS[0];
  const [places, businesses] = await Promise.all([
    ctx.store.listPlatformPlaceSubmissions(
      ctx.actor,
      (selected.status ?? undefined) as
        | PlacePlatformModerationStatus
        | undefined,
    ),
    ctx.store.listBusinesses(ctx.actor),
  ]);
  const businessById = new Map(businesses.map((business) => [business.id, business]));

  return (
    <PlatformAdminShell>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Platform Content</p>
        <h1 className="mt-1 text-2xl font-semibold">ตรวจสถานที่จากร้าน</h1>
        <p className="mt-2 text-sm text-white/60">
          อนุมัติเพื่อให้มีสิทธิ์แสดงบนพื้นที่ค้นหาของ KubHai — ไม่ได้เพิ่มขึ้นหน้าแรกอัตโนมัติ
        </p>
      </div>

      <nav className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {TAB_OPTIONS.map((item) => (
          <Link
            key={item.value}
            href={`/admin/places?tab=${item.value}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${
              selected.value === item.value
                ? "bg-accent font-semibold text-navy-950"
                : "bg-white/10 text-white/75"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 space-y-4">
        {places.map((place) => {
          const business = place.businessId
            ? businessById.get(place.businessId)
            : null;
          return (
            <article
              key={place.id}
              className="grid gap-4 rounded-3xl bg-white/5 p-5 ring-1 ring-white/8 md:grid-cols-[240px_1fr]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvePlaceImageUrl(place)}
                alt=""
                className="aspect-[4/3] w-full rounded-2xl bg-black/20 object-cover"
              />
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-accent">
                      {PLACE_CATEGORY_LABELS[place.category]}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{place.name}</h2>
                    <p className="mt-1 text-sm text-white/60">
                      ส่งโดย {business?.name ?? "ไม่พบร้าน"} · {place.area || place.address || "ไม่ระบุพื้นที่"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                    {STATUS_LABEL[place.platformModerationStatus]}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/75">
                  {place.shortDescription || place.description || "ไม่มีคำอธิบาย"}
                </p>
                <div className="mt-3 grid gap-1 text-xs text-white/50 sm:grid-cols-2">
                  <p>ที่อยู่: {place.address || "—"}</p>
                  <p>Google Place ID: {place.googlePlaceId || "—"}</p>
                  <p>
                    พิกัด: {place.latitude != null && place.longitude != null
                      ? `${place.latitude}, ${place.longitude}`
                      : "—"}
                  </p>
                  <p>
                    ส่งเมื่อ: {place.platformSubmittedAt
                      ? new Date(place.platformSubmittedAt).toLocaleString("th-TH")
                      : "—"}
                  </p>
                </div>
                {place.platformRejectionReason ? (
                  <p className="mt-3 rounded-xl bg-red-300/10 px-3 py-2 text-sm text-red-100">
                    เหตุผล: {place.platformRejectionReason}
                  </p>
                ) : null}
                {place.platformModerationStatus === "PENDING_REVIEW" ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <form action={reviewPlatformPlaceAction}>
                      <input type="hidden" name="placeId" value={place.id} />
                      <input type="hidden" name="decision" value="APPROVE" />
                      <button className="h-11 w-full rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white">
                        อนุมัติ
                      </button>
                    </form>
                    <form action={reviewPlatformPlaceAction} className="grid gap-2">
                      <input type="hidden" name="placeId" value={place.id} />
                      <input type="hidden" name="decision" value="REJECT" />
                      <input
                        name="reason"
                        required
                        maxLength={240}
                        placeholder="เหตุผลที่ไม่ผ่าน"
                        className="h-11 rounded-xl bg-white px-3 text-sm text-navy-950"
                      />
                      <button className="h-11 rounded-xl bg-red-500 px-4 text-sm font-semibold text-white">
                        ไม่ผ่าน
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
        {!places.length ? (
          <p className="rounded-2xl bg-white/5 p-5 text-sm text-white/60">
            ไม่มีรายการในสถานะนี้
          </p>
        ) : null}
      </div>
    </PlatformAdminShell>
  );
}
