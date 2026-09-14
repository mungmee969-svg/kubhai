import type { TripPackageStatus } from "@/lib/domain/trip-package";

export const TRIP_PACKAGE_STATUS_LABELS: Record<TripPackageStatus, string> = {
  DRAFT: "ฉบับร่าง",
  PUBLISHED: "เผยแพร่แล้ว",
  UNPUBLISHED: "ปิดการแสดง",
  ARCHIVED: "เก็บถาวร",
};

/** Tailwind text tone per status — admin list + form badges. */
export const TRIP_PACKAGE_STATUS_TONES: Record<TripPackageStatus, string> = {
  DRAFT: "text-muted",
  PUBLISHED: "text-success",
  UNPUBLISHED: "text-navy-800",
  ARCHIVED: "text-muted",
};
