/**
 * Location provider abstraction.
 * Prefer Google Places when API key is configured; otherwise Chiang Mai local catalog.
 */

import type { StructuredLocation } from "@/lib/domain/location";

export type LocationSuggestion = {
  placeId: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  placeType: string;
};

const CHIANG_MAI_PLACES: LocationSuggestion[] = [
  {
    placeId: "cm-airport",
    label: "สนามบินเชียงใหม่ (CNX)",
    address: "ตำบลสุเทพ อำเภอเมืองเชียงใหม่",
    latitude: 18.7669,
    longitude: 98.9626,
    placeType: "airport",
  },
  {
    placeId: "cm-nimman",
    label: "นิมมานเหมินทร์",
    address: "ถนนนิมมานเหมินทร์ เชียงใหม่",
    latitude: 18.8002,
    longitude: 98.9675,
    placeType: "area",
  },
  {
    placeId: "cm-doi-suthep",
    label: "ดอยสุเทพ",
    address: "วัดพระธาตุดอยสุเทพ เชียงใหม่",
    latitude: 18.8047,
    longitude: 98.9215,
    placeType: "attraction",
  },
  {
    placeId: "cm-old-city",
    label: "เมืองเก่าเชียงใหม่",
    address: "ประตูท่าแพ เชียงใหม่",
    latitude: 18.7877,
    longitude: 98.9932,
    placeType: "area",
  },
  {
    placeId: "cm-maya",
    label: "Maya Lifestyle Shopping Center",
    address: "นิมมานเหมินทร์ เชียงใหม่",
    latitude: 18.8026,
    longitude: 98.9678,
    placeType: "mall",
  },
  {
    placeId: "cm-railway",
    label: "สถานีรถไฟเชียงใหม่",
    address: "ถนนเจริญเมือง เชียงใหม่",
    latitude: 18.7837,
    longitude: 99.0168,
    placeType: "transit",
  },
];

export type LocationSearchProvider = {
  search(query: string): Promise<LocationSuggestion[]>;
  popular(): Promise<LocationSuggestion[]>;
  reverseGeocode(lat: number, lng: number): Promise<StructuredLocation>;
  /** Resolve Google placeId → full lat/lng when available */
  resolvePlace?(placeId: string): Promise<LocationSuggestion | null>;
};

export const localLocationProvider: LocationSearchProvider = {
  async search(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return CHIANG_MAI_PLACES.slice(0, 6);
    return CHIANG_MAI_PLACES.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.placeType.includes(q),
    );
  },
  async popular() {
    return CHIANG_MAI_PLACES.slice(0, 4);
  },
  async reverseGeocode(lat: number, lng: number) {
    // Never guess a human-readable address from the Chiang Mai demo catalog.
    // Browser geolocation coordinates are authoritative; a real reverse-geocoder
    // can enrich the address later without replacing the actual GPS point.
    return {
      label: "ตำแหน่งปัจจุบัน",
      address: "ตำแหน่งจากอุปกรณ์ของคุณ",
      latitude: lat,
      longitude: lng,
      placeId: null,
      placeType: "current_location",
      customerNote: null,
      source: "CURRENT_LOCATION",
    };
  },
};

/**
 * Client hybrid: tries /api/places/autocomplete (Google) then merges/falls back to local catalog.
 * Selection always goes through resolvePlace so name/address/lat/lng come from one result.
 */
export const hybridLocationProvider: LocationSearchProvider = {
  async search(query: string) {
    const local = await localLocationProvider.search(query);
    const q = query.trim();
    if (q.length < 2 || typeof window === "undefined") return local;
    try {
      const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      if (!res.ok) return local;
      const data = (await res.json()) as {
        configured?: boolean;
        suggestions?: LocationSuggestion[];
      };
      if (!data.configured || !data.suggestions?.length) return local;
      const google = data.suggestions.filter((item) => item.placeId);
      const localOnly = local.filter((item) => !google.some((g) => g.label === item.label));
      return [...google, ...localOnly].slice(0, 12);
    } catch {
      return local;
    }
  },
  async popular() {
    return localLocationProvider.popular();
  },
  async reverseGeocode(lat: number, lng: number) {
    return localLocationProvider.reverseGeocode(lat, lng);
  },
  async resolvePlace(placeId: string) {
    if (placeId.startsWith("cm-")) {
      return CHIANG_MAI_PLACES.find((item) => item.placeId === placeId) ?? null;
    }
    if (typeof window === "undefined") return null;
    try {
      const res = await fetch(
        `/api/places/autocomplete?placeId=${encodeURIComponent(placeId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { place?: LocationSuggestion | null };
      return data.place ?? null;
    } catch {
      return null;
    }
  },
};

export function getLocationProvider(): LocationSearchProvider {
  return hybridLocationProvider;
}

export function isProductionMapsConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  );
}
