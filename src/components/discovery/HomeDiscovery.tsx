"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlaceCard } from "@/components/discovery/PlaceCard";
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_CATEGORY_LABELS,
  RECOMMENDED_PERIOD_LABELS,
  filterDiscoveryPlaces,
  type DiscoveryCategory,
} from "@/lib/domain/discovery";
import type { Place, RecommendedPeriod } from "@/lib/domain/types";

const PERIODS: Array<RecommendedPeriod | "ALL"> = ["ALL", "DAY", "EVENING", "NIGHT"];

export function HomeDiscovery({
  places,
  provinceId,
}: {
  places: Place[];
  provinceId: string;
}) {
  const [category, setCategory] = useState<DiscoveryCategory | "ALL">("ALL");
  const [period, setPeriod] = useState<RecommendedPeriod | "ALL">("ALL");

  const filtered = useMemo(
    () =>
      filterDiscoveryPlaces(places, {
        provinceId,
        category,
        period,
        limit: 12,
      }),
    [places, provinceId, category, period],
  );

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-accent-deep">เชียงใหม่</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-navy-900 sm:text-3xl">
            แนะนำในเชียงใหม่
          </h2>
          <p className="mt-1 text-sm text-muted">เที่ยว · กิน · คาเฟ่ · ที่พัก · ช้อป — ไม่ต้องเข้าสู่ระบบก็ดูได้</p>
        </div>
        <Link
          href="/places?province=chiang-mai"
          className="shrink-0 text-sm font-medium text-navy-700 underline-offset-4 hover:underline"
        >
          ดูทั้งหมด
        </Link>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
        {(["ALL", ...DISCOVERY_CATEGORIES] as const).map((key) => {
          const active = category === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium transition ${
                active ? "bg-navy-800 text-white" : "bg-white text-navy-800 ring-1 ring-navy-950/8"
              }`}
            >
              {DISCOVERY_CATEGORY_LABELS[key]}
            </button>
          );
        })}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
        {PERIODS.map((key) => {
          const active = period === key;
          const label = key === "ALL" ? "ทุกช่วงเวลา" : RECOMMENDED_PERIOD_LABELS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold transition ${
                active ? "bg-accent text-navy-950" : "bg-[#ebe6dc] text-navy-800"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {filtered.length ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
          {filtered.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-white px-4 py-6 text-sm text-muted ring-1 ring-navy-950/5">
          ยังไม่มีสถานที่ในตัวกรองนี้
        </p>
      )}
    </section>
  );
}
