import type {
  Booking,
  BookingItineraryItem,
  BookingRequestInput,
} from "@/lib/domain/types";

export type DurableBookingResult = {
  id: string;
  token: string;
  bookingCode: string;
  reused: boolean;
  createdAt: string;
};

export type DurableBookingRecord = {
  booking: Booking;
  itinerary: BookingItineraryItem[];
  businessSlug: string;
};

type RpcEnvelope = {
  id?: unknown;
  token?: unknown;
  bookingCode?: unknown;
  reused?: unknown;
  createdAt?: unknown;
};

type ReadRpcEnvelope = {
  id?: unknown;
  businessId?: unknown;
  businessSlug?: unknown;
  bookingCode?: unknown;
  token?: unknown;
  clientRequestId?: unknown;
  serviceType?: unknown;
  startDate?: unknown;
  status?: unknown;
  payload?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isDurableBookingConfigured() {
  return config() !== null;
}

async function rpc<T>(name: string, body: unknown): Promise<T> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase booking persistence is not configured");

  const response = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Supabase booking RPC ${name} failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as T;
}

export async function createDurableBookingRequest(
  input: BookingRequestInput,
): Promise<DurableBookingResult> {
  const raw = await rpc<RpcEnvelope>("create_public_booking_request", {
    p_payload: input,
  });

  if (
    typeof raw.id !== "string" ||
    typeof raw.token !== "string" ||
    typeof raw.bookingCode !== "string" ||
    typeof raw.createdAt !== "string"
  ) {
    throw new Error("Supabase booking RPC returned an invalid response");
  }

  return {
    id: raw.id,
    token: raw.token,
    bookingCode: raw.bookingCode,
    reused: raw.reused === true,
    createdAt: raw.createdAt,
  };
}

export async function getDurableBookingByToken(
  token: string,
): Promise<DurableBookingRecord | null> {
  if (!token || token.length < 20 || !isDurableBookingConfigured()) return null;

  const raw = await rpc<ReadRpcEnvelope | null>("get_public_booking_request", {
    p_token: token,
  });
  if (!raw) return null;
  if (
    typeof raw.id !== "string" ||
    typeof raw.businessId !== "string" ||
    typeof raw.businessSlug !== "string" ||
    typeof raw.bookingCode !== "string" ||
    typeof raw.token !== "string" ||
    typeof raw.clientRequestId !== "string" ||
    typeof raw.createdAt !== "string" ||
    typeof raw.updatedAt !== "string" ||
    !raw.payload ||
    typeof raw.payload !== "object"
  ) {
    throw new Error("Supabase booking read RPC returned an invalid response");
  }

  const input = raw.payload as BookingRequestInput;
  const booking: Booking = {
    id: raw.id,
    businessId: raw.businessId,
    bookingCode: raw.bookingCode,
    securePublicToken: raw.token,
    clientRequestId: raw.clientRequestId,
    tripPackageId: input.tripPackageId ?? null,
    customerId: null,
    customerAccountId: null,
    customerNameSnapshot: input.customerName,
    customerPhoneSnapshot: input.customerPhone,
    customerEmailSnapshot: input.customerEmail,
    customerType: input.customerType,
    companyName: input.companyName,
    taxId: input.taxId,
    serviceType: input.serviceType,
    startDate: input.startDate,
    startTime: input.startTime,
    endDate: input.endDate,
    endTime: input.endTime,
    passengerCount: input.passengerCount,
    luggageCount: input.luggageCount,
    pickupLocation: input.pickupLocation,
    pickupLat: input.pickupLat ?? null,
    pickupLng: input.pickupLng ?? null,
    pickupAddress: input.pickupAddress ?? null,
    pickupPlaceId: input.pickupPlaceId ?? null,
    pickupNote: input.pickupNote ?? null,
    pickupSource: input.pickupSource ?? null,
    dropoffLocation: input.dropoffLocation,
    dropoffLat: input.dropoffLat ?? null,
    dropoffLng: input.dropoffLng ?? null,
    dropoffAddress: input.dropoffAddress ?? null,
    dropoffPlaceId: input.dropoffPlaceId ?? null,
    dropoffNote: input.dropoffNote ?? null,
    dropoffSource: input.dropoffSource ?? null,
    tripNotes: input.tripNotes,
    letStorePlanTrip: input.letStorePlanTrip,
    preferredVehicleId: input.preferredVehicleId,
    assignedVehicleId: null,
    assignedDriverId: null,
    status: (typeof raw.status === "string" ? raw.status : "REQUESTED") as Booking["status"],
    quotedTotal: null,
    depositAmount: null,
    paidAmount: 0,
    balanceAmount: null,
    driverFeeAmount: null,
    receivingAccountId: null,
    acceptedQuotationId: null,
    source: input.source,
    actualStartAt: null,
    pickupCheckedInAt: null,
    dropoffCheckedInAt: null,
    actualEndAt: null,
    scheduledEndAtSnapshot: null,
    earlyCompletionReason: null,
    earlyCompletionNote: null,
    completedByUserId: null,
    completedAt: null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  const itinerary: BookingItineraryItem[] = (input.itineraryDays ?? []).map(
    (item, index) => ({
      id: `${raw.id}-itinerary-${index + 1}`,
      bookingId: raw.id,
      businessId: raw.businessId,
      placeId: item.placeId,
      title: item.title,
      location: item.location,
      dayNumber: item.dayNumber,
      estimatedMinutes: null,
      note: item.note,
      sortOrder: item.sortOrder,
      kind: item.kind,
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.address,
      source: item.source,
    }),
  );

  return { booking, itinerary, businessSlug: raw.businessSlug };
}
