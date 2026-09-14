"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPlaceToBookingDraft } from "@/lib/booking/draft";
import type { Place } from "@/lib/domain/types";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";

const PERIOD_KEYS = ["morning", "afternoon", "evening", "night"] as const;
type PeriodKey = (typeof PERIOD_KEYS)[number];

type Props = {
  place: Place;
  storeSlug: string;
  defaultDays?: number;
};

export function AddToTripButton({ place, storeSlug, defaultDays = 3 }: Props) {
  const router = useRouter();
  const { t } = useCustomerPrefs();
  const [open, setOpen] = useState(false);
  const [dayNumber, setDayNumber] = useState(1);
  const [period, setPeriod] = useState<PeriodKey | "">("");
  const [asHotelEnd, setAsHotelEnd] = useState(place.category === "HOTEL");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const days = useMemo(
    () => Array.from({ length: Math.max(1, defaultDays) }, (_, i) => i + 1),
    [defaultDays],
  );

  function confirm() {
    startTransition(() => {
      addPlaceToBookingDraft(storeSlug, place, {
        dayNumber,
        numberOfDays: Math.max(defaultDays, dayNumber),
        asHotelEnd: asHotelEnd && place.category === "HOTEL",
        preferredPeriod: period ? t(`travel.period.${period}`) : null,
      });
      setDone(true);
      setOpen(false);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-[color:var(--cx-textPrimary)]"
        >
          {t("travel.addToTrip")}
        </button>
        <a
          href={`/s/${storeSlug}?book=1`}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-navy-800 px-5 text-sm font-semibold text-white"
        >
          {t("travel.bookForTrip")}
        </a>
      </div>
      {done ? (
        <p className="mt-3 text-sm text-success">
          {t("travel.addedToTrip")} ·{" "}
          <button
            type="button"
            className="font-semibold text-accent-deep underline-offset-2 hover:underline"
            onClick={() => router.push(`/s/${storeSlug}?book=1`)}
          >
            {t("travel.viewPlan")}
          </button>
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-navy-950/40"
            aria-label={t("nav.close")}
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[color:var(--cx-surface)] p-5 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">{t("place.addToTripSheet")}</p>
                <h2 className="text-lg font-semibold text-[color:var(--cx-textPrimary)]">{place.name}</h2>
              </div>
              <button type="button" className="text-sm text-muted" onClick={() => setOpen(false)}>
                {t("nav.close")}
              </button>
            </div>

            <p className="text-sm font-medium text-[color:var(--cx-textPrimary)]">{t("place.whichDay")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDayNumber(day)}
                  className={`h-11 min-w-16 rounded-2xl px-3 text-sm font-semibold ${
                    dayNumber === day ? "bg-navy-800 text-white" : "bg-paper text-[color:var(--cx-textPrimary)]"
                  }`}
                >
                  {t("place.dayLabel", { n: day })}
                </button>
              ))}
            </div>

            <p className="mt-5 text-sm font-medium text-[color:var(--cx-textPrimary)]">{t("place.preferredPeriod")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PERIOD_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key === period ? "" : key)}
                  className={`h-10 rounded-full px-3 text-sm ${
                    period === key ? "bg-accent text-[color:var(--cx-textPrimary)]" : "bg-paper text-[color:var(--cx-textPrimary)]"
                  }`}
                >
                  {t(`travel.period.${key}`)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{t("place.periodPlanningHint")}</p>

            {place.category === "HOTEL" ? (
              <label className="mt-5 flex items-start gap-2 rounded-2xl bg-paper px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={asHotelEnd}
                  onChange={(e) => setAsHotelEnd(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  {t("place.asHotelEnd")}
                  <span className="mt-0.5 block text-xs text-muted">{t("place.asHotelEndHint")}</span>
                </span>
              </label>
            ) : null}

            <button
              type="button"
              disabled={pending}
              onClick={confirm}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-navy-800 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? t("common.loading") : t("place.confirmAddToTrip")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
