import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { AddToTripButton } from "@/components/discovery/AddToTripButton";
import {
  DISCOVERY_CATEGORY_LABELS,
  discoveryCategoryOf,
  placeCoverUrl,
  placeShortText,
  RECOMMENDED_PERIOD_LABELS,
} from "@/lib/domain/discovery";
import { PLACE_CATEGORY_LABELS } from "@/lib/domain/enums";
import { getStoreContextSlug } from "@/lib/auth/store-context";
import { getStore } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = await getStore().getPublicPlaceBySlug(slug);
  if (!row) return { title: "สถานที่" };
  return {
    title: row.place.name,
    description: placeShortText(row.place) || undefined,
  };
}

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const storeApi = getStore();
  const row = await storeApi.getPublicPlaceBySlug(slug);
  if (!row) notFound();
  const { place, province } = row;
  const cover = placeCoverUrl(place);
  const chip = discoveryCategoryOf(place);
  const categoryLabel = chip
    ? DISCOVERY_CATEGORY_LABELS[chip]
    : PLACE_CATEGORY_LABELS[place.category] ?? "สถานที่";
  const contextSlug = await getStoreContextSlug();
  const partner =
    (contextSlug ? await storeApi.getPublicStore(contextSlug) : null) ??
    (await storeApi.getPublicStore("pondcarrent"));
  const storeSlug = partner?.business.slug ?? contextSlug ?? "pondcarrent";
  const backHref = contextSlug ? `/s/${contextSlug}/travel` : "/places?province=chiang-mai";

  return (
    <div className="min-h-dvh bg-[#f6f3ee] text-navy-950">
      <div className="relative mx-auto max-w-lg">
        <div className="relative aspect-[4/3] overflow-hidden bg-navy-800">
          <Image src={cover} alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-navy-950/30" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-4">
            <Link
              href={backHref}
              className="inline-flex h-10 items-center rounded-full bg-white/90 px-4 text-sm font-medium text-navy-900 backdrop-blur"
            >
              ← กลับ
            </Link>
            <BrandMark size={32} className="shadow" />
          </div>
          {place.sponsored ? (
            <span className="absolute bottom-4 left-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-navy-800">
              {place.sponsorLabel || "สนับสนุน"}
            </span>
          ) : null}
        </div>

        <main className="space-y-5 px-4 py-6 pb-28">
          <div>
            <p className="text-sm font-medium text-accent-deep">
              {categoryLabel}
              {place.area ? ` · ${place.area}` : ""}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy-900">{place.name}</h1>
            {place.placeKind && place.placeKind !== "PLACE" ? (
              <p className="mt-1 text-xs font-medium text-muted">
                {place.placeKind === "AREA"
                  ? "ย่าน / จุดรวม — ไม่ใช่ชื่อร้านเฉพาะ"
                  : place.placeKind === "GUIDE"
                    ? "คู่มือแนะนำ — ไม่ใช่สถานประกอบการเฉพาะ"
                    : "เนื้อหาบรรณาธิการ"}
              </p>
            ) : null}
            {province ? <p className="mt-1 text-sm text-muted">{province.nameTh}</p> : null}
          </div>

          {placeShortText(place) ? (
            <p className="text-sm leading-relaxed text-navy-800">{placeShortText(place)}</p>
          ) : null}
          {place.description && place.description !== place.shortDescription ? (
            <p className="text-sm leading-relaxed text-muted">{place.description}</p>
          ) : null}

          {place.recommendedPeriods.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">ช่วงที่แนะนำให้ไป</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {place.recommendedPeriods.map((period) => (
                  <span key={period} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-navy-800 ring-1 ring-navy-950/8">
                    {RECOMMENDED_PERIOD_LABELS[period]}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">คำแนะนำช่วงเวลา — ไม่ใช่เวลาเปิด–ปิดร้าน</p>
            </div>
          ) : null}

          {place.address ? (
            <div className="rounded-2xl bg-white p-4 ring-1 ring-navy-950/5">
              <p className="text-xs font-semibold text-muted">ตำแหน่ง</p>
              <p className="mt-1 text-sm text-navy-900">{place.address}</p>
            </div>
          ) : null}

          {place.tags.length ? (
            <div className="flex flex-wrap gap-2">
              {place.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-navy-800/5 px-3 py-1 text-xs text-navy-800">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {place.imageUrls.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {place.imageUrls.slice(0, 6).map((src) => (
                <span key={src} className="relative h-24 w-36 shrink-0 overflow-hidden rounded-2xl">
                  <Image src={src} alt="" fill sizes="144px" className="object-cover" />
                </span>
              ))}
            </div>
          ) : null}

          <AddToTripButton place={place} storeSlug={storeSlug} />
        </main>
      </div>
    </div>
  );
}
