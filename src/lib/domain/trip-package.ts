import type { BookingDraft } from "@/lib/booking/draft";
import { emptyDayPlan, type DayPlan } from "@/lib/booking/itinerary";
import type { CustomerLocale } from "@/lib/i18n/locales";
import { isCustomerLocale } from "@/lib/i18n/locales";
import type { StructuredLocation } from "@/lib/domain/location";

type IsoDateTime = string;
type Uuid = string;

export const TRIP_PACKAGE_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
] as const;

export type TripPackageStatus = (typeof TRIP_PACKAGE_STATUSES)[number];

/** Required Thai + optional EN/ZH marketing copy. */
export type LocalizedText = {
  th: string;
  en?: string;
  zh?: string;
};

export type LocalizedStringList = {
  th: string[];
  en?: string[];
  zh?: string[];
};

/** Optional localized paragraph (conditions / notes). */
export type LocalizedOptionalText = {
  th?: string;
  en?: string;
  zh?: string;
};

export type TripPackageStop = {
  placeId?: Uuid | null;
  title: LocalizedText;
  timeApprox?: string | null;
  note?: string | null;
};

export type TripPackageDay = {
  dayNumber: number;
  title: LocalizedText;
  description: LocalizedText;
  stops: TripPackageStop[];
};

/**
 * Sellable multi-day trip product for a storefront.
 * Quote-first by default: startingPrice may be null; never auto-confirms bookings.
 */
export type TripPackage = {
  id: Uuid;
  businessId: Uuid;
  status: TripPackageStatus;
  featured: boolean;
  displayOrder: number;
  days: number;
  nights: number;
  passengerMin: number;
  passengerMax: number;
  vehicleCategoryHint: string | null;
  /** null = quote-first / ask store */
  startingPrice: number | null;
  quoteFirst: boolean;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  title: LocalizedText;
  summary: LocalizedText;
  highlights: LocalizedStringList;
  included: LocalizedStringList;
  notIncluded: LocalizedStringList;
  conditions: LocalizedOptionalText;
  notes: LocalizedOptionalText;
  itinerary: TripPackageDay[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  publishedAt?: IsoDateTime | null;
};

export type TripPackageWriteInput = {
  featured?: boolean;
  displayOrder?: number;
  days: number;
  nights: number;
  passengerMin: number;
  passengerMax: number;
  vehicleCategoryHint?: string | null;
  startingPrice?: number | null;
  quoteFirst?: boolean;
  coverImageUrl?: string | null;
  galleryImageUrls?: string[];
  title: LocalizedText;
  summary: LocalizedText;
  highlights: LocalizedStringList;
  included: LocalizedStringList;
  notIncluded: LocalizedStringList;
  conditions?: LocalizedOptionalText;
  notes?: LocalizedOptionalText;
  itinerary: TripPackageDay[];
};

export type TripPackageUpdateInput = Partial<TripPackageWriteInput>;

export type TripPackageListFilter = {
  status?: TripPackageStatus | TripPackageStatus[];
  featured?: boolean;
  includeArchived?: boolean;
};

export function localizedPackageText(
  locale: CustomerLocale | string,
  fields: LocalizedOptionalText | LocalizedText | null | undefined,
  fallback = "",
): string {
  if (!fields) return fallback;
  const loc: CustomerLocale = isCustomerLocale(locale) ? locale : "th";
  const preferred = fields[loc]?.trim();
  if (preferred) return preferred;
  const th = fields.th?.trim();
  if (th) return th;
  const en = fields.en?.trim();
  if (en) return en;
  const zh = fields.zh?.trim();
  if (zh) return zh;
  return fallback;
}

export function localizedPackageList(
  locale: CustomerLocale | string,
  fields: LocalizedStringList | null | undefined,
  fallback: string[] = [],
): string[] {
  if (!fields) return fallback;
  const loc: CustomerLocale = isCustomerLocale(locale) ? locale : "th";
  const preferred = fields[loc];
  if (Array.isArray(preferred) && preferred.length) return preferred;
  if (Array.isArray(fields.th) && fields.th.length) return fields.th;
  if (Array.isArray(fields.en) && fields.en.length) return fields.en;
  if (Array.isArray(fields.zh) && fields.zh.length) return fields.zh;
  return fallback;
}

/** Customer-visible catalog entries — published only. */
export function isCustomerVisiblePackage(pkg: Pick<TripPackage, "status">): boolean {
  return pkg.status === "PUBLISHED";
}

/** Featured first, then displayOrder ascending, then updatedAt desc. */
export function sortFeaturedPackages(packages: TripPackage[]): TripPackage[] {
  return [...packages].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function packageDurationLabel(
  locale: CustomerLocale | string,
  days: number,
  nights: number,
): string {
  const loc: CustomerLocale = isCustomerLocale(locale) ? locale : "th";
  const d = Math.max(0, Math.floor(days));
  const n = Math.max(0, Math.floor(nights));
  if (loc === "en") {
    const dayPart = d === 1 ? "1 day" : `${d} days`;
    const nightPart = n === 1 ? "1 night" : `${n} nights`;
    return `${dayPart} ${nightPart}`;
  }
  if (loc === "zh") {
    return `${d}天${n}晚`;
  }
  return `${d} วัน ${n} คืน`;
}

function stopToLocation(stop: TripPackageStop, locale: CustomerLocale = "th"): StructuredLocation {
  return {
    label: localizedPackageText(locale, stop.title, "จุดแวะ"),
    address: null,
    latitude: null,
    longitude: null,
    placeId: stop.placeId ?? null,
    placeType: null,
    customerNote: [stop.timeApprox, stop.note].filter(Boolean).join(" · ") || null,
    source: stop.placeId ? "SAVED_PLACE" : "MANUAL",
  };
}

function packageDayToDayPlan(day: TripPackageDay, locale: CustomerLocale = "th"): DayPlan {
  const plan = emptyDayPlan(day.dayNumber, "");
  const firstTime = day.stops.find((s) => s.timeApprox)?.timeApprox;
  plan.startTime = firstTime?.trim() || "09:00";
  plan.stops = day.stops.map((stop) => stopToLocation(stop, locale));
  const desc = localizedPackageText(locale, day.description);
  const title = localizedPackageText(locale, day.title);
  plan.notes = [title, desc].filter(Boolean).join(" — ");
  plan.undecided = false;
  plan.inheritStartFromPrevious = day.dayNumber > 1;
  return plan;
}

/**
 * Prefill a booking draft from a package.
 * Does not confirm or price — quote-first flow stays intact.
 */
export function mapPackageToBookingDraftPrefill(
  pkg: TripPackage,
  locale: CustomerLocale | string = "th",
): Partial<BookingDraft> {
  const loc: CustomerLocale = isCustomerLocale(locale) ? locale : "th";
  const title = localizedPackageText(loc, pkg.title);
  const summary = localizedPackageText(loc, pkg.summary);
  const packageNote = localizedPackageText(loc, pkg.notes);
  const noteParts = [
    title ? `แพ็กเกจ: ${title}` : null,
    summary || null,
    packageNote || null,
  ].filter(Boolean);

  const sortedDays = [...pkg.itinerary].sort((a, b) => a.dayNumber - b.dayNumber);
  const days: DayPlan[] =
    sortedDays.length > 0
      ? sortedDays.map((day) => packageDayToDayPlan(day, loc))
      : Array.from({ length: Math.max(1, pkg.days) }, (_, i) => emptyDayPlan(i + 1, ""));

  return {
    serviceType: "MULTI_DAY_TRIP",
    multiDay: pkg.days > 1,
    numberOfDays: Math.max(1, pkg.days),
    days,
    passengers: Math.max(1, pkg.passengerMin),
    letStorePlanTrip: false,
    notes: noteParts.join("\n"),
  };
}
