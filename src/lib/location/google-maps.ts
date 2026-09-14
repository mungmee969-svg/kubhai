/**
 * Client-safe Google Maps configuration boundary.
 * Server Places calls live in google-places.ts; booking/admin search uses provider.ts.
 *
 * Env (never hardcode):
 * - GOOGLE_MAPS_API_KEY — server-preferred (Places API New)
 * - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — client-visible hint for UI + optional Maps JS
 */

export {
  isGooglePlacesConfigured as isGoogleMapsConfigured,
  resolveGoogleMapsApiKey,
  googlePlacesAutocomplete as searchPlaces,
  googlePlaceDetails as getPlaceDetails,
} from "@/lib/location/google-places";

export function normalizeGooglePlace(input: {
  placeId: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  placeType?: string;
}) {
  return {
    placeId: input.placeId,
    name: input.label,
    formattedAddress: input.address,
    lat: input.latitude,
    lng: input.longitude,
    placeType: input.placeType ?? "google_place",
  };
}

/** Browser-only: whether a public key is present for Maps JS / UI messaging. */
export function isGoogleMapsBrowserConfigured(): boolean {
  return Boolean(
    typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
        process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim()),
  );
}
