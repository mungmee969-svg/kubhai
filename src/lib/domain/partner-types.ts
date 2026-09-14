/**
 * Partner / Agent service-type taxonomy (extensible).
 * KubHai discovers partners; partners deliver the service.
 */

export const PARTNER_SERVICE_TYPES = [
  "CHAUFFEUR",
  "CAR_RENTAL_SELF_DRIVE",
  "MOTORCYCLE_RENTAL",
  "AIRPORT_TRANSFER",
  "POINT_TO_POINT",
  "TOUR_TRANSPORT",
  "MULTI_DAY_DRIVER",
] as const;

export type PartnerServiceType = (typeof PARTNER_SERVICE_TYPES)[number];

export const PARTNER_SERVICE_TYPE_LABELS: Record<PartnerServiceType, string> = {
  CHAUFFEUR: "รถพร้อมคนขับ",
  CAR_RENTAL_SELF_DRIVE: "เช่ารถขับเอง",
  MOTORCYCLE_RENTAL: "เช่ามอเตอร์ไซค์",
  AIRPORT_TRANSFER: "รับส่งสนามบิน",
  POINT_TO_POINT: "รับส่งจุดต่อจุด",
  TOUR_TRANSPORT: "รถทัวร์ / ทริป",
  MULTI_DAY_DRIVER: "ทริปหลายวัน",
};

export function normalizePartnerServiceTypes(raw: unknown): PartnerServiceType[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(PARTNER_SERVICE_TYPES);
  return raw.filter((item): item is PartnerServiceType => typeof item === "string" && allowed.has(item));
}
