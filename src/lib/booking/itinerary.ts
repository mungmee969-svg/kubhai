import type { StructuredLocation } from "@/lib/domain/location";

export type ItineraryItemKind =
  | "START"
  | "STOP"
  | "END_OF_DAY"
  | "FINAL"
  | "UNDECIDED"
  | "STORE_HELP";

export type DayPlan = {
  dayNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  /** Day 1 = initial pickup; middle days often inherit previous end */
  startLocation: StructuredLocation | null;
  inheritStartFromPrevious: boolean;
  stops: StructuredLocation[];
  /** End of day / hotel (not final trip dropoff except on last day) */
  endLocation: StructuredLocation | null;
  notes: string;
  /** Customer left this day for the store to plan */
  undecided: boolean;
};

export const STORE_HELP_INTERESTS = [
  "ธรรมชาติ",
  "วัด",
  "คาเฟ่",
  "อาหาร",
  "เด็ก/ครอบครัว",
  "ถ่ายรูป",
  "ช้อปปิ้ง",
] as const;

export type StoreHelpInterest = (typeof STORE_HELP_INTERESTS)[number];

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyDayPlan(dayNumber: number, date: string): DayPlan {
  return {
    dayNumber,
    date,
    startTime: dayNumber === 1 ? "09:00" : "09:00",
    endTime: "",
    startLocation: null,
    inheritStartFromPrevious: dayNumber > 1,
    stops: [],
    endLocation: null,
    notes: "",
    undecided: false,
  };
}

export function buildDaysFromDuration(
  startDate: string,
  numberOfDays: number,
  previous?: DayPlan[],
): DayPlan[] {
  const n = Math.max(1, Math.min(30, Math.floor(numberOfDays) || 1));
  const result: DayPlan[] = [];
  for (let i = 0; i < n; i++) {
    const date = startDate ? addDaysIso(startDate, i) : "";
    const existing = previous?.find((d) => d.dayNumber === i + 1);
    if (existing) {
      result.push({
        ...existing,
        dayNumber: i + 1,
        date,
        inheritStartFromPrevious: i > 0 ? existing.inheritStartFromPrevious : false,
      });
      continue;
    }
    const day = emptyDayPlan(i + 1, date);
    const prevEnd = i > 0 ? result[i - 1]?.endLocation ?? null : null;
    if (i > 0 && prevEnd) {
      day.startLocation = prevEnd;
      day.inheritStartFromPrevious = true;
    }
    result.push(day);
  }
  return result;
}

export function derivedEndDate(startDate: string, numberOfDays: number): string {
  if (!startDate) return "";
  return addDaysIso(startDate, Math.max(1, numberOfDays) - 1);
}

const TH_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

export function formatThaiShortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const month = TH_MONTHS[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

export function formatThaiDateRange(startDate: string, numberOfDays: number): string {
  if (!startDate) return "—";
  const end = derivedEndDate(startDate, numberOfDays);
  if (numberOfDays <= 1) return formatThaiShortDate(startDate);
  return `${formatThaiShortDate(startDate)} – ${formatThaiShortDate(end)}`;
}

export function dayHasContent(day: DayPlan): boolean {
  if (day.undecided || day.notes.trim() || day.stops.length > 0) return true;
  if (day.endLocation) return true;
  // Inherited start alone is not user-authored itinerary content
  if (day.startLocation && !day.inheritStartFromPrevious) return true;
  return false;
}

export function resolveDayStart(
  day: DayPlan,
  previous: DayPlan | null,
): StructuredLocation | null {
  if (day.inheritStartFromPrevious && previous?.endLocation) {
    return previous.endLocation;
  }
  return day.startLocation;
}

export type SerializableItineraryItem = {
  dayNumber: number;
  sortOrder: number;
  kind: ItineraryItemKind;
  title: string;
  location: string | null;
  placeId: string | null;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  source: StructuredLocation["source"] | null;
};

function locToItem(
  dayNumber: number,
  sortOrder: number,
  kind: ItineraryItemKind,
  loc: StructuredLocation,
  noteExtra?: string | null,
): SerializableItineraryItem {
  return {
    dayNumber,
    sortOrder,
    kind,
    title: loc.label,
    location: loc.address,
    placeId: loc.placeId,
    note: noteExtra ?? loc.customerNote,
    latitude: loc.latitude,
    longitude: loc.longitude,
    address: loc.address,
    source: loc.source,
  };
}

/** Flatten day plans into canonical BookingItineraryItem-shaped rows (create-time). */
export function daysToItineraryItems(days: DayPlan[]): SerializableItineraryItem[] {
  const items: SerializableItineraryItem[] = [];
  days.forEach((day, dayIndex) => {
    const prev = dayIndex > 0 ? days[dayIndex - 1] : null;
    const isLast = dayIndex === days.length - 1;
    let order = 0;

    if (day.undecided) {
      items.push({
        dayNumber: day.dayNumber,
        sortOrder: order++,
        kind: "UNDECIDED",
        title: "ยังไม่ได้วางแผน — ให้ร้านช่วยแนะนำ",
        location: null,
        placeId: null,
        note: day.notes || null,
        latitude: null,
        longitude: null,
        address: null,
        source: null,
      });
      return;
    }

    const start = resolveDayStart(day, prev);
    if (start) {
      items.push(
        locToItem(
          day.dayNumber,
          order++,
          dayIndex === 0 ? "START" : "START",
          start,
          day.startTime ? `เวลา ${day.startTime}` : null,
        ),
      );
    }

    day.stops.forEach((stop) => {
      items.push(locToItem(day.dayNumber, order++, "STOP", stop));
    });

    if (day.endLocation) {
      items.push(
        locToItem(
          day.dayNumber,
          order++,
          isLast ? "FINAL" : "END_OF_DAY",
          day.endLocation,
          day.endTime ? `เวลา ${day.endTime}` : day.notes || null,
        ),
      );
    } else if (day.notes.trim()) {
      items.push({
        dayNumber: day.dayNumber,
        sortOrder: order++,
        kind: "STORE_HELP",
        title: "หมายเหตุวันนี้",
        location: null,
        placeId: null,
        note: day.notes,
        latitude: null,
        longitude: null,
        address: null,
        source: null,
      });
    }
  });
  return items;
}

export function collectPlaceIdsFromDays(days: DayPlan[]): string[] {
  const ids: string[] = [];
  for (const day of days) {
    const start = day.startLocation?.placeId;
    if (start && !ids.includes(start)) ids.push(start);
    for (const stop of day.stops) {
      if (stop.placeId && !ids.includes(stop.placeId)) ids.push(stop.placeId);
    }
    const end = day.endLocation?.placeId;
    if (end && !ids.includes(end)) ids.push(end);
  }
  return ids.slice(0, 20);
}

export function initialPickupFromDays(days: DayPlan[]): StructuredLocation | null {
  if (!days.length) return null;
  return days[0].startLocation;
}

export function finalDropoffFromDays(days: DayPlan[]): StructuredLocation | null {
  if (!days.length) return null;
  const last = days[days.length - 1];
  return last.endLocation;
}

export function groupItineraryByDay<T extends { dayNumber: number | null; sortOrder: number }>(
  items: T[],
): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const day = item.dayNumber && item.dayNumber > 0 ? item.dayNumber : 1;
    const list = map.get(day) ?? [];
    list.push(item);
    map.set(day, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return map;
}

export function kindLabel(kind: ItineraryItemKind | string | null | undefined): string {
  switch (kind) {
    case "START":
      return "เริ่ม";
    case "STOP":
      return "แวะ";
    case "END_OF_DAY":
      return "จบวัน";
    case "FINAL":
      return "ส่งสุดท้าย";
    case "UNDECIDED":
      return "ยังไม่วางแผน";
    case "STORE_HELP":
      return "ให้ร้านช่วย";
    default:
      return "จุด";
  }
}
