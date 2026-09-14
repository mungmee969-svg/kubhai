/**
 * Structured location + trip check-in domain.
 *
 * Expected pickup/dropoff (booking fields) are NEVER overwritten by GPS check-in.
 * Check-in is operational evidence only — does NOT settle money.
 */

export type LocationSource = "SEARCH" | "CURRENT_LOCATION" | "MAP_PIN" | "SAVED_PLACE" | "MANUAL";

export type StructuredLocation = {
  label: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  placeType: string | null;
  customerNote: string | null;
  source: LocationSource;
};

export type CheckInKind = "PICKUP" | "DROPOFF";

export type ProximityBand = "GOOD" | "WARNING" | "FAR" | "UNKNOWN";

export type LocationOverrideReason =
  | "ACTUAL_POINT_CHANGED"
  | "CUSTOMER_REQUESTED_OTHER"
  | "GPS_INACCURATE"
  | "ENTRANCE_MISMATCH"
  | "OTHER";

export const LOCATION_OVERRIDE_REASONS: LocationOverrideReason[] = [
  "ACTUAL_POINT_CHANGED",
  "CUSTOMER_REQUESTED_OTHER",
  "GPS_INACCURATE",
  "ENTRANCE_MISMATCH",
  "OTHER",
];

export const LOCATION_OVERRIDE_LABELS: Record<LocationOverrideReason, string> = {
  ACTUAL_POINT_CHANGED: "จุดรับ/ส่งจริงเปลี่ยน",
  CUSTOMER_REQUESTED_OTHER: "ลูกค้าขอให้ไปอีกจุด",
  GPS_INACCURATE: "GPS คลาดเคลื่อน",
  ENTRANCE_MISMATCH: "ทางเข้า/จุดจอดไม่ตรงหมุด",
  OTHER: "อื่น ๆ",
};

/** Haversine distance in meters. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export const PROXIMITY_GOOD_M = 150;
export const PROXIMITY_WARNING_M = 500;

export function proximityBand(distanceM: number | null): ProximityBand {
  if (distanceM == null || !Number.isFinite(distanceM)) return "UNKNOWN";
  if (distanceM <= PROXIMITY_GOOD_M) return "GOOD";
  if (distanceM <= PROXIMITY_WARNING_M) return "WARNING";
  return "FAR";
}

export function proximityLabel(band: ProximityBand, distanceM: number | null): string {
  if (band === "UNKNOWN" || distanceM == null) return "ไม่มีพิกัดเปรียบเทียบ";
  if (band === "GOOD") return `ห่างจากหมุด ${distanceM} ม. ✓`;
  if (band === "WARNING") return `ห่างจากหมุดประมาณ ${distanceM} ม.`;
  return `คุณอยู่ห่างจากจุดที่กำหนดประมาณ ${distanceM} เมตร`;
}

export type TripProgress =
  | "AWAITING_PICKUP"
  | "PICKUP_CHECKED_IN"
  | "TRIP_STARTED"
  | "DROPOFF_CHECKED_IN"
  | "COMPLETED"
  | "NONE";

export const TRIP_PROGRESS_LABEL: Record<TripProgress, string> = {
  NONE: "ยังไม่เริ่ม",
  AWAITING_PICKUP: "ยังไม่เช็กอิน",
  PICKUP_CHECKED_IN: "ถึงจุดรับแล้ว",
  TRIP_STARTED: "กำลังเดินทาง",
  DROPOFF_CHECKED_IN: "ถึงปลายทาง",
  COMPLETED: "เสร็จสิ้น",
};

export type TripCheckIn = {
  id: string;
  businessId: string;
  bookingId: string;
  kind: CheckInKind;
  checkedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  distanceFromExpectedM: number | null;
  proximity: ProximityBand;
  overrideReason: LocationOverrideReason | null;
  note: string | null;
  actorUserId: string | null;
  createdAt: string;
};

export function deriveTripProgress(input: {
  status: string;
  actualStartAt: string | null;
  pickupCheckIn: TripCheckIn | null;
  dropoffCheckIn: TripCheckIn | null;
}): TripProgress {
  if (input.status === "COMPLETED") return "COMPLETED";
  if (input.dropoffCheckIn) return "DROPOFF_CHECKED_IN";
  if (input.actualStartAt || input.status === "IN_PROGRESS") return "TRIP_STARTED";
  if (input.pickupCheckIn) return "PICKUP_CHECKED_IN";
  if (input.status === "CONFIRMED" || input.status === "IN_PROGRESS") return "AWAITING_PICKUP";
  return "NONE";
}

/** Dispatch / list views — uses denormalized check-in timestamps on booking. */
export function deriveTripProgressFromBooking(booking: {
  status: string;
  actualStartAt: string | null;
  pickupCheckedInAt?: string | null;
  dropoffCheckedInAt?: string | null;
}): TripProgress {
  return deriveTripProgress({
    status: booking.status,
    actualStartAt: booking.actualStartAt,
    pickupCheckIn: booking.pickupCheckedInAt
      ? ({ checkedAt: booking.pickupCheckedInAt } as TripCheckIn)
      : null,
    dropoffCheckIn: booking.dropoffCheckedInAt
      ? ({ checkedAt: booking.dropoffCheckedInAt } as TripCheckIn)
      : null,
  });
}

export function customerTripLabel(progress: TripProgress): string | null {
  switch (progress) {
    case "AWAITING_PICKUP":
      return "คนขับกำลังเดินทาง";
    case "PICKUP_CHECKED_IN":
      return "คนขับถึงจุดรับแล้ว";
    case "TRIP_STARTED":
      return "เริ่มเดินทางแล้ว";
    case "DROPOFF_CHECKED_IN":
      return "ถึงปลายทางแล้ว";
    case "COMPLETED":
      return "งานเสร็จสิ้น";
    default:
      return null;
  }
}

export function displayLocationLabel(booking: {
  pickupLocation: string;
  pickupAddress?: string | null;
}): string {
  return booking.pickupAddress?.trim() || booking.pickupLocation;
}

export function toStructuredFromBookingPickup(booking: {
  pickupLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress?: string | null;
  pickupPlaceId?: string | null;
  pickupNote?: string | null;
  pickupSource?: LocationSource | null;
}): StructuredLocation {
  return {
    label: booking.pickupLocation,
    address: booking.pickupAddress ?? null,
    latitude: booking.pickupLat,
    longitude: booking.pickupLng,
    placeId: booking.pickupPlaceId ?? null,
    placeType: null,
    customerNote: booking.pickupNote ?? null,
    source: booking.pickupSource ?? "MANUAL",
  };
}

export function toStructuredFromBookingDropoff(booking: {
  dropoffLocation: string | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  dropoffAddress?: string | null;
  dropoffPlaceId?: string | null;
  dropoffNote?: string | null;
  dropoffSource?: LocationSource | null;
}): StructuredLocation | null {
  if (!booking.dropoffLocation) return null;
  return {
    label: booking.dropoffLocation,
    address: booking.dropoffAddress ?? null,
    latitude: booking.dropoffLat,
    longitude: booking.dropoffLng,
    placeId: booking.dropoffPlaceId ?? null,
    placeType: null,
    customerNote: booking.dropoffNote ?? null,
    source: booking.dropoffSource ?? "MANUAL",
  };
}

export function assertOverrideAllowed(
  band: ProximityBand,
  overrideReason: LocationOverrideReason | null | undefined,
  note?: string | null,
) {
  if (band !== "FAR") return;
  if (!overrideReason || !LOCATION_OVERRIDE_REASONS.includes(overrideReason)) {
    throw new Error("จุดเช็กอินห่างจากหมุด — ต้องระบุเหตุผล");
  }
  if (overrideReason === "OTHER" && !note?.trim()) {
    throw new Error("กรุณาระบุรายละเอียดเมื่อเลือกอื่น ๆ");
  }
}
