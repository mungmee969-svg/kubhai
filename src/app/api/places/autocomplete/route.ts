import { NextResponse } from "next/server";
import {
  googlePlaceDetails,
  googlePlacesAutocomplete,
  isGooglePlacesConfigured,
} from "@/lib/location/google-places";

export const dynamic = "force-dynamic";

/** Autocomplete — returns Google suggestions when configured; else empty. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const placeId = searchParams.get("placeId")?.trim() ?? "";

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

  if (q.length < 2) {
    return NextResponse.json({ ok: true, configured: true, suggestions: [], place: null });
  }

  const suggestions = await googlePlacesAutocomplete(q);
  return NextResponse.json({ ok: true, configured: true, suggestions, place: null });
}
