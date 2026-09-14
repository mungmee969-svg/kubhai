import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { PlaceCard } from "@/components/discovery/PlaceCard";
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_CATEGORY_LABELS,
  RECOMMENDED_PERIOD_LABELS,
  discoverySearchTokens,
  filterDiscoveryPlaces,
  type DiscoveryCategory,
} from "@/lib/domain/discovery";
import type { RecommendedPeriod } from "@/lib/domain/types";
import { getStore } from "@/lib/data";
import { SEED } from "@/lib/data/seed-ids";

export const dynamic = "force-dynamic";
export const metadata = { title: "ค้นหาสถานที่" };

export default async function PlacesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ province?: string; category?: string; period?: string; q?: string }>;
}) {
  const query = await searchParams;
  const provinceSlug = query.province || "chiang-mai";
  const category = (query.category as DiscoveryCategory | undefined) || "ALL";
  const period = (query.period as RecommendedPeriod | "ALL" | undefined) || "ALL";
  const q = (query.q || "").trim().toLowerCase();
  const storeApi = getStore();
  const places = await storeApi.listPublicPlaces({ provinceSlug });
  const provinceId =
    places[0]?.provinceId ??
    (await storeApi.getPublicStore("pondcarrent"))?.province?.id ??
    SEED.provinceChiangMai;

  let filtered = filterDiscoveryPlaces(places, {
    provinceId,
    category: category === "ALL" || !category ? "ALL" : category,
    period: period === "ALL" || !period ? "ALL" : period,
    limit: 40,
  });
  if (q) {
    filtered = filtered.filter((place) =>
      discoverySearchTokens(place).some((token) => token.includes(q) || q.includes(token)),
    );
  }

  return (
    <div className="min-h-dvh bg-[#f6f3ee] text-navy-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link href="/" className="mb-6 inline-flex items-center gap-2">
          <BrandMark size={36} />
          <span className="font-semibold">KubHai</span>
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">ค้นหาสถานที่</h1>
        <p className="mt-2 text-sm text-muted">
          {q ? `ค้นหา: ${query.q}` : "เชียงใหม่ · เลือกหมวดและช่วงเวลาที่อยากไป"}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["ALL", ...DISCOVERY_CATEGORIES] as const).map((key) => {
            const href =
              key === "ALL"
                ? `/places?province=${provinceSlug}${period !== "ALL" ? `&period=${period}` : ""}${q ? `&q=${encodeURIComponent(query.q!)}` : ""}`
                : `/places?province=${provinceSlug}&category=${key}${period !== "ALL" ? `&period=${period}` : ""}${q ? `&q=${encodeURIComponent(query.q!)}` : ""}`;
            const active = (category === "ALL" && key === "ALL") || category === key;
            return (
              <Link
                key={key}
                href={href}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  active ? "bg-navy-800 text-white" : "bg-white text-navy-800 ring-1 ring-navy-950/8"
                }`}
              >
                {DISCOVERY_CATEGORY_LABELS[key]}
              </Link>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["ALL", "DAY", "EVENING", "NIGHT"] as const).map((key) => {
            const href =
              key === "ALL"
                ? `/places?province=${provinceSlug}${category !== "ALL" ? `&category=${category}` : ""}${q ? `&q=${encodeURIComponent(query.q!)}` : ""}`
                : `/places?province=${provinceSlug}&period=${key}${category !== "ALL" ? `&category=${category}` : ""}${q ? `&q=${encodeURIComponent(query.q!)}` : ""}`;
            const active = (period === "ALL" && key === "ALL") || period === key;
            return (
              <Link
                key={key}
                href={href}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active ? "bg-accent text-navy-950" : "bg-[#ebe6dc] text-navy-800"
                }`}
              >
                {key === "ALL" ? "ทุกช่วงเวลา" : RECOMMENDED_PERIOD_LABELS[key]}
              </Link>
            );
          })}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((place) => (
            <PlaceCard key={place.id} place={place} layout="grid" />
          ))}
        </div>
        {!filtered.length ? (
          <p className="mt-8 text-sm text-muted">ยังไม่มีสถานที่ในตัวกรองนี้</p>
        ) : null}
      </div>
    </div>
  );
}
