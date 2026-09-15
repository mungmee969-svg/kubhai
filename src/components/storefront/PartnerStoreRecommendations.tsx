"use client";

import Link from "next/link";
import { travelPlaceCoverUrl, travelPlaceShortText } from "@/lib/domain/travel-recommendations";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";
import type { Place } from "@/lib/domain/types";
import type { PlaceCategory } from "@/lib/domain/enums";

const CATEGORY_KEYS: Record<PlaceCategory, string> = {
  ATTRACTION: "travel.popular",
  RESTAURANT: "travel.restaurant",
  LOCAL_FOOD: "travel.localFood",
  CAFE: "travel.cafe",
  HOTEL: "travel.hotel",
  ACTIVITY: "travel.activity",
  SOUVENIR: "travel.souvenir",
  RELAXATION: "place.category.relaxation",
  SPA: "place.category.spa",
  SHOPPING: "place.category.shopping",
  OTHER: "place.category.other",
};

export function PartnerStoreRecommendations({
  places,
  storeSlug,
}: {
  places: Place[];
  storeSlug: string;
}) {
  const { t } = useCustomerPrefs();
  if (!places.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-[color:var(--cx-textPrimary)] md:text-lg">
          {t("travel.storeRecommendations")}
        </h2>
        <p className="mt-0.5 text-xs text-[color:var(--cx-textSecondary)] sm:text-sm">
          {t("travel.storeRecommendationsSubtitle")}
        </p>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:px-0">
        {places.slice(0, 6).map((place) => (
          <Link
            key={place.id}
            href={`/s/${storeSlug}/travel/${place.slug}`}
            className="group w-[min(68vw,230px)] shrink-0 overflow-hidden rounded-2xl bg-[color:var(--cx-surface)] shadow-sm ring-1 ring-[color:var(--cx-border)] sm:w-[190px]"
          >
            <div className="relative h-28 overflow-hidden bg-[color:var(--store-paper,#F7F4EF)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={travelPlaceCoverUrl(place)}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <span className="absolute left-2 top-2 rounded-full bg-[color:var(--cx-surface)]/92 px-2 py-0.5 text-[10px] font-medium text-[color:var(--cx-textPrimary)]">
                {t(CATEGORY_KEYS[place.category])}
              </span>
            </div>
            <div className="p-3">
              <p className="line-clamp-1 text-sm font-semibold text-[color:var(--cx-textPrimary)]">
                {place.name}
              </p>
              <p className="mt-1 line-clamp-1 text-[11px] text-[color:var(--cx-textSecondary)]">
                <span aria-hidden>📍 </span>
                {place.area || place.address || "—"}
              </p>
              <p className="mt-1.5 line-clamp-2 min-h-8 text-[11px] leading-relaxed text-[color:var(--cx-textSecondary)]">
                {travelPlaceShortText(place) || " "}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
