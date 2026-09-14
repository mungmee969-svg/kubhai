"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { addPlaceToBookingDraft, readBookingDraft } from "@/lib/booking/draft";
import {
  TRAVEL_RECOMMENDATION_CHIPS,
  filterTravelRecommendations,
  travelPlaceCoverUrl,
  travelPlaceShortText,
  type TravelRecommendationChip,
} from "@/lib/domain/travel-recommendations";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";
import type { Place } from "@/lib/domain/types";
import type { PlaceCategory } from "@/lib/domain/enums";

const CHIP_LABEL_KEYS: Record<TravelRecommendationChip | "ALL", string> = {
  ALL: "travel.all",
  ATTRACTION: "travel.popular",
  RESTAURANT: "travel.restaurant",
  LOCAL_FOOD: "travel.localFood",
  CAFE: "travel.cafe",
  HOTEL: "travel.hotel",
  ACTIVITY: "travel.activity",
  SOUVENIR: "travel.souvenir",
};

const PLACE_CATEGORY_KEYS: Record<PlaceCategory, string> = {
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

/**
 * Compact horizontal Place carousel for travel tips.
 * Same Place source as Store Admin places. Never mounts in BookingWizard.
 */
export function PartnerTravelDiscovery({
  places,
  provinceId,
  storeSlug,
  locationLabel = "Chiang Mai",
  mode = "full",
}: {
  places: Place[];
  provinceId: string | null;
  storeSlug: string;
  locationLabel?: string;
  mode?: "preview" | "full";
}) {
  const router = useRouter();
  const { t } = useCustomerPrefs();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState<TravelRecommendationChip | "ALL">("ALL");
  const [addedId, setAddedId] = useState<string | null>(null);
  const [preservedHint, setPreservedHint] = useState<string | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const filtered = useMemo(
    () =>
      filterTravelRecommendations(places, {
        provinceId,
        category,
        limit: mode === "preview" ? 8 : 24,
      }),
    [places, provinceId, category, mode],
  );

  function updateScrollState() {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft < max - 8);
    const card = el.querySelector<HTMLElement>("[data-place-card]");
    const step = card ? card.offsetWidth + 12 : el.clientWidth * 0.7;
    const pages = Math.max(1, Math.ceil(max / Math.max(step, 1)) + 1);
    setPageCount(pages);
    setPageIndex(Math.min(pages - 1, Math.round(el.scrollLeft / Math.max(step, 1))));
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollState) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro?.disconnect();
    };
  }, [filtered.length, category]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: 0 });
    updateScrollState();
  }, [category]);

  if (!places.filter((p) => p.status === "ACTIVE").length) return null;

  function addToTrip(place: Place) {
    const before = readBookingDraft(storeSlug);
    addPlaceToBookingDraft(storeSlug, place, { dayNumber: 1, numberOfDays: 1 });
    setAddedId(place.id);
    setPreservedHint(before ? t("travel.draftPreserved") : null);
  }

  function scrollByCards(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-place-card]");
    const step = card ? (card.offsetWidth + 12) * (dir === 1 ? 1 : -1) : dir * el.clientWidth * 0.75;
    el.scrollBy({ left: step, behavior: "smooth" });
  }

  return (
    <section id="travel" className="space-y-3 scroll-mt-20">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-[color:var(--cx-textPrimary)] md:text-lg">
            {t("travel.title")}
          </h2>
          <p className="truncate text-xs text-[color:var(--cx-textSecondary)] sm:text-sm">
            {t("travel.subtitle", { place: locationLabel })}
          </p>
        </div>
        <Link
          href={mode === "preview" ? `/s/${storeSlug}/travel` : `/s/${storeSlug}?book=1`}
          className="shrink-0 text-sm font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
        >
          {mode === "preview" ? `${t("travel.viewAll")} →` : `${t("travel.bookRide")} →`}
        </Link>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none">
        {(["ALL", ...TRAVEL_RECOMMENDATION_CHIPS] as const).map((key) => {
          const active = category === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`h-8 shrink-0 rounded-full px-3 text-[11px] font-medium transition sm:h-9 sm:text-xs ${
                active
                  ? "bg-[color:var(--store-primary,#0F3D3E)] text-white"
                  : "bg-[color:var(--cx-surface)] text-[color:var(--cx-textPrimary)] ring-1 ring-[color:var(--cx-border)]"
              }`}
            >
              {t(CHIP_LABEL_KEYS[key])}
            </button>
          );
        })}
      </div>

      {filtered.length ? (
        <div className="relative">
          <button
            type="button"
            aria-label={t("travel.scrollPrev")}
            onClick={() => scrollByCards(-1)}
            disabled={!canPrev}
            className="absolute -left-1 top-[42%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[color:var(--cx-surface)] text-lg text-[color:var(--cx-textPrimary)] shadow-md ring-1 ring-[color:var(--cx-border)] disabled:opacity-30 md:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={t("travel.scrollNext")}
            onClick={() => scrollByCards(1)}
            disabled={!canNext}
            className="absolute -right-1 top-[42%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[color:var(--cx-surface)] text-lg text-[color:var(--cx-textPrimary)] shadow-md ring-1 ring-[color:var(--cx-border)] disabled:opacity-30 md:flex"
          >
            ›
          </button>

          <div
            ref={scrollerRef}
            className="travel-place-carousel -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:px-1"
          >
            {filtered.map((place) => {
              const cover = travelPlaceCoverUrl(place);
              const short = travelPlaceShortText(place);
              const areaLine = [place.area, locationLabel].filter(Boolean).join(" · ");
              const added = addedId === place.id;
              return (
                <article
                  key={place.id}
                  data-place-card
                  className="travel-place-card flex w-[min(68vw,248px)] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-[color:var(--cx-surface)] shadow-sm ring-1 ring-[color:var(--cx-border)] sm:w-[200px] lg:w-[186px]"
                >
                  <Link href={`/s/${storeSlug}/travel/${place.slug}`} className="block min-w-0">
                    <div className="relative h-[7.25rem] overflow-hidden bg-[color:var(--store-paper,#F7F4EF)] sm:h-[7.5rem]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute left-2 top-2 max-w-[85%] truncate rounded-full bg-[color:var(--cx-surface)]/92 px-2 py-0.5 text-[10px] font-medium text-[color:var(--cx-textPrimary)]">
                        {t(PLACE_CATEGORY_KEYS[place.category])}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-1 px-3 pb-2 pt-2.5">
                      <p className="line-clamp-1 text-sm font-semibold leading-snug text-[color:var(--cx-textPrimary)]">
                        {place.name}
                      </p>
                      <p className="line-clamp-1 text-[11px] text-[color:var(--cx-textSecondary)]">
                        <span aria-hidden>📍 </span>
                        {areaLine || locationLabel}
                      </p>
                      <p className="line-clamp-2 min-h-[2.25rem] text-[11px] leading-relaxed text-[color:var(--cx-textSecondary)]">
                        {short || " "}
                      </p>
                    </div>
                  </Link>
                  <div className="mt-auto px-3 pb-3">
                    <button
                      type="button"
                      onClick={() => addToTrip(place)}
                      className="h-9 w-full rounded-full bg-[color:var(--store-primary-soft,#E8F0EF)] text-[11px] font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
                    >
                      {added ? t("travel.addedToTrip") : t("travel.addToTrip")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {pageCount > 1 ? (
            <div className="mt-2 hidden justify-center gap-1.5 md:flex" aria-hidden>
              {Array.from({ length: Math.min(pageCount, 6) }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${
                    i === pageIndex
                      ? "bg-[color:var(--store-primary,#0F3D3E)]"
                      : "bg-[color:var(--cx-textSecondary)]/40"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl bg-[color:var(--cx-surface)] px-4 py-4 text-sm text-[color:var(--cx-textSecondary)] shadow-sm ring-1 ring-[color:var(--cx-border)]">
          {t("travel.emptyCategory")}
        </p>
      )}

      {addedId ? (
        <div className="rounded-2xl bg-[color:var(--store-primary,#0F3D3E)] px-3.5 py-3 text-white">
          <p className="text-sm font-medium">{t("travel.addedToTrip")}</p>
          {preservedHint ? <p className="mt-0.5 text-xs text-white/75">{preservedHint}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="h-9 rounded-full bg-white/15 px-3 text-xs font-semibold"
              onClick={() => router.push(`/s/${storeSlug}?book=1`)}
            >
              {t("travel.viewPlan")}
            </button>
            <button
              type="button"
              className="h-9 rounded-full bg-[color:var(--store-accent,#C4A35A)] px-3 text-xs font-semibold text-[#1a1510]"
              onClick={() => router.push(`/s/${storeSlug}?book=1`)}
            >
              {t("travel.bookForTrip")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
