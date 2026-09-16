import { NextResponse } from "next/server";
import {
  googlePlaceDetails,
  googlePlacesAutocomplete,
  googleReverseGeocode,
  isGooglePlacesConfigured,
} from "@/lib/location/google-places";

export const dynamic = "force-dynamic";

/** Places boundary — autocomplete, place details, and reverse geocoding. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const placeId = searchParams.get("placeId")?.trim() ?? "";
  const rawLatitude = searchParams.get("lat");
  const rawLongitude = searchParams.get("lng");
  const latitude = rawLatitude == null ? null : Number(rawLatitude);
  const longitude = rawLongitude == null ? null : Number(rawLongitude);
  const hasCoordinates =
    latitude != null && longitude != null &&
    Number.isFinite(latitude) && Number.isFinite(longitude);

  if (!isGooglePlacesConfigured()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      suggestions: [] as unknown[],
      place: null,
    });
  }

  if (placeId) {
    const place = await googlePlaceDetails(placeId);
    return NextResponse.json({
      ok: true,
      configured: true,
      suggestions: [],
      place,
    });
  }

  // Coordinates without a search query mean reverse-geocode this exact pin.
  if (!q && hasCoordinates) {
    const place = await googleReverseGeocode(latitude, longitude);
    return NextResponse.json({
      ok: true,
      configured: true,
      suggestions: [],
      place,
    });
  }

  if (q.length < 2) {
    return NextResponse.json({ ok: true, configured: true, suggestions: [], place: null });
  }

  const suggestions = await googlePlacesAutocomplete(q, {
    latitude: hasCoordinates ? latitude : null,
    longitude: hasCoordinates ? longitude : null,
  });
  return NextResponse.json({ ok: true, configured: true, suggestions, place: null });
}
