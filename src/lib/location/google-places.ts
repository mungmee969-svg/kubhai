/**
 * Google Places helpers (server boundary used by the app places endpoint).
 *
 * Prefer GOOGLE_MAPS_API_KEY for server calls. NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * remains a compatibility fallback while production credentials are migrated.
 */

import type { LocationSuggestion } from "@/lib/location/provider";

export function resolveGoogleMapsApiKey(): string | null {
  const key =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    "";
  return key || null;
}

function googleRequestHeaders(key: string, fieldMask: string) {
  return {
    "X-Goog-Api-Key": key,
    "X-Goog-FieldMask": fieldMask,
    Referer: "https://www.kubhai.org/",
  };
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(resolveGoogleMapsApiKey());
}

type AutocompletePrediction = {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
};

export async function googlePlacesAutocomplete(
  query: string,
  options?: { latitude?: number | null; longitude?: number | null },
): Promise<LocationSuggestion[]> {
  const key = resolveGoogleMapsApiKey();
  const q = query.trim();
  if (!key || q.length < 2) return [];

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...googleRequestHeaders(
          key,
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
        ),
      },
      body: JSON.stringify({
        input: q,
        languageCode: "th",
        includedRegionCodes: ["th"],
        ...(Number.isFinite(options?.latitude) && Number.isFinite(options?.longitude)
          ? {
              locationBias: {
                circle: {
                  center: {
                    latitude: Number(options?.latitude),
                    longitude: Number(options?.longitude),
                  },
                  radius: 40000,
                },
              },
            }
          : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { suggestions?: AutocompletePrediction[] };
    const out: LocationSuggestion[] = [];
    for (const item of data.suggestions ?? []) {
      const pred = item.placePrediction;
      if (!pred?.placeId) continue;
      const label = pred.structuredFormat?.mainText?.text?.trim() || pred.text?.text?.trim() || "สถานที่";
      const address = pred.structuredFormat?.secondaryText?.text?.trim() || pred.text?.text?.trim() || "";
      out.push({ placeId: pred.placeId, label, address, latitude: 0, longitude: 0, placeType: "google_place" });
    }
    return out;
  } catch {
    return [];
  }
}

export async function googlePlaceDetails(placeId: string): Promise<LocationSuggestion | null> {
  const key = resolveGoogleMapsApiKey();
  if (!key || !placeId.trim()) return null;

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: googleRequestHeaders(key, "id,displayName,formattedAddress,location,types"),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      types?: string[];
    };
    const lat = data.location?.latitude;
    const lng = data.location?.longitude;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      placeId: data.id || placeId,
      label: data.displayName?.text?.trim() || "สถานที่",
      address: data.formattedAddress?.trim() || "",
      latitude: lat,
      longitude: lng,
      placeType: data.types?.[0] || "google_place",
    };
  } catch {
    return null;
  }
}

/**
 * Describe a confirmed map pin with Places API (New), which is already part of
 * the KubHai Maps setup. The returned place is only a readable description;
 * the customer's exact pin coordinates remain authoritative.
 */
export async function googleReverseGeocode(
  latitude: number,
  longitude: number,
): Promise<LocationSuggestion | null> {
  const key = resolveGoogleMapsApiKey();
  if (!key || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...googleRequestHeaders(key, "places.id,places.displayName,places.formattedAddress,places.location,places.types"),
      },
      body: JSON.stringify({
        languageCode: "th",
        rankPreference: "DISTANCE",
        maxResultCount: 1,
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: 100,
          },
        },
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        types?: string[];
      }>;
    };
    const hit = data.places?.[0];
    const address = hit?.formattedAddress?.trim();
    if (!hit || !address) return null;
    return {
      placeId: hit.id || null,
      label: hit.displayName?.text?.trim() || address.split(",")[0]?.trim() || address,
      address,
      // Preserve the exact customer-confirmed pin, not the nearby POI centroid.
      latitude,
      longitude,
      placeType: hit.types?.[0] || "map_pin",
    };
  } catch {
    return null;
  }
}
