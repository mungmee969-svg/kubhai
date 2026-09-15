/**
 * Google Places helpers (server-side).
 * Uses the server-only GOOGLE_MAPS_API_KEY.
 * Never hardcode secrets — configure via environment.
 */

import type { LocationSuggestion } from "@/lib/location/provider";

export function resolveGoogleMapsApiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
  return key || null;
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

/**
 * Places API (New) Autocomplete with optional caller-provided location bias.
 * Returns empty array when key missing or request fails (caller falls back to local).
 */
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
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
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
      const label =
        pred.structuredFormat?.mainText?.text?.trim() ||
        pred.text?.text?.trim() ||
        "สถานที่";
      const address =
        pred.structuredFormat?.secondaryText?.text?.trim() ||
        pred.text?.text?.trim() ||
        "";
      out.push({
        placeId: pred.placeId,
        label,
        address,
        latitude: 0,
        longitude: 0,
        placeType: "google_place",
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function googlePlaceDetails(
  placeId: string,
): Promise<LocationSuggestion | null> {
  const key = resolveGoogleMapsApiKey();
  if (!key || !placeId.trim()) return null;

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,location,types",
        },
        cache: "no-store",
      },
    );
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
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
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
