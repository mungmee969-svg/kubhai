/**
 * Vehicle imagery — separate from Place discovery images.
 * Prefer cover → first gallery → clean vehicle placeholder (never Place / hero / logo).
 */

import type { Vehicle } from "./types";

const PLACEHOLDER_BY_TYPE: { match: RegExp; url: string }[] = [
  { match: /van|commuter|alphard|hiace|comuter/i, url: "/fleet/van.jpg" },
  { match: /suv|fortuner|pajero/i, url: "/fleet/suv.jpg" },
];

export const VEHICLE_IMAGE_PLACEHOLDER = "/fleet/car.jpg";

export function resolveVehicleCoverUrl(
  vehicle: Pick<Vehicle, "coverImageUrl" | "imageUrls" | "vehicleType" | "model">,
): string {
  if (vehicle.coverImageUrl?.trim()) return vehicle.coverImageUrl.trim();
  const first = vehicle.imageUrls?.find((url) => url?.trim());
  if (first) return first.trim();
  const hay = `${vehicle.vehicleType} ${vehicle.model}`;
  for (const row of PLACEHOLDER_BY_TYPE) {
    if (row.match.test(hay)) return row.url;
  }
  return VEHICLE_IMAGE_PLACEHOLDER;
}

export function resolveVehicleGallery(
  vehicle: Pick<Vehicle, "coverImageUrl" | "imageUrls">,
): string[] {
  const urls: string[] = [];
  const push = (url: string | null | undefined) => {
    const trimmed = url?.trim();
    if (!trimmed) return;
    if (!urls.includes(trimmed)) urls.push(trimmed);
  };
  push(vehicle.coverImageUrl);
  for (const url of vehicle.imageUrls ?? []) push(url);
  return urls;
}
