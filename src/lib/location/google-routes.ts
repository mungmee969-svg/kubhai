/**
 * Server-only Google Routes boundary.
 *
 * Route estimates are advisory display data only. This module never imports
 * quotation, pricing, booking mutation, or payment code.
 */

export type RoutePoint = { latitude: number; longitude: number };

export type RouteEstimate = {
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
};

export type RouteEstimateResult = {
  configured: boolean;
  route: RouteEstimate | null;
};

function resolveRoutesApiKey(): string | null {
  const key =
    process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim() ||
    process.env.GOOGLE_ROUTES_API_KEY?.trim() ||
    "";
  return key || null;
}

export function isGoogleRoutesConfigured(): boolean {
  return Boolean(resolveRoutesApiKey());
}

export async function computeGoogleRoute(input: {
  origin: RoutePoint;
  destination: RoutePoint;
  intermediates?: RoutePoint[];
}): Promise<RouteEstimateResult> {
  const key = resolveRoutesApiKey();
  if (!key) return { configured: false, route: null };

  const waypoint = (point: RoutePoint) => ({
    location: {
      latLng: {
        latitude: point.latitude,
        longitude: point.longitude,
      },
    },
  });
  try {
    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: waypoint(input.origin),
          destination: waypoint(input.destination),
          intermediates: (input.intermediates ?? []).map(waypoint),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
        cache: "no-store",
      },
    );
    if (!response.ok) return { configured: true, route: null };
    const payload = (await response.json()) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        polyline?: { encodedPolyline?: string };
      }>;
    };
    const route = payload.routes?.[0];
    const durationSeconds = Number(route?.duration?.replace(/s$/, ""));
    if (
      !route?.polyline?.encodedPolyline ||
      !Number.isFinite(route.distanceMeters) ||
      !Number.isFinite(durationSeconds)
    ) {
      return { configured: true, route: null };
    }
    return {
      configured: true,
      route: {
        encodedPolyline: route.polyline.encodedPolyline,
        distanceMeters: Number(route.distanceMeters),
        durationSeconds,
      },
    };
  } catch {
    return { configured: true, route: null };
  }
}
