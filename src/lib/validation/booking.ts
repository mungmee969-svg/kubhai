import { z } from "zod";
import { BOOKING_SOURCES, CUSTOMER_TYPES, SERVICE_TYPES } from "@/lib/domain/enums";
import { normalizeClockTime, filterUuidPlaceIds } from "@/lib/booking/normalize";

const clockTimeSchema = z
  .union([z.string(), z.null()])
  .transform((value) => normalizeClockTime(value))
  .refine((value) => value === null || /^\d{2}:\d{2}$/.test(value), {
    message: "Invalid time",
  });

const uuidPlaceIdsSchema = z.preprocess(
  (value) => filterUuidPlaceIds(Array.isArray(value) ? (value as string[]) : []),
  z.array(z.string().uuid()).max(20),
);

export const bookingRequestSchema = z.object({
  businessSlug: z.string().min(1).max(80),
  clientRequestId: z.string().uuid(),
  serviceType: z.enum(SERVICE_TYPES),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: clockTimeSchema,
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endTime: clockTimeSchema,
  passengerCount: z.number().int().min(1).max(20),
  luggageCount: z.number().int().min(0).max(30).nullable(),
  pickupLocation: z.string().trim().min(2).max(200),
  pickupLat: z.number().min(-90).max(90).nullable().optional(),
  pickupLng: z.number().min(-180).max(180).nullable().optional(),
  pickupAddress: z.string().trim().max(300).nullable().optional(),
  pickupPlaceId: z.string().trim().max(80).nullable().optional(),
  pickupNote: z.string().trim().max(200).nullable().optional(),
  pickupSource: z
    .enum(["SEARCH", "CURRENT_LOCATION", "MAP_PIN", "SAVED_PLACE", "MANUAL"])
    .nullable()
    .optional(),
  dropoffLocation: z.string().trim().max(200).nullable(),
  dropoffLat: z.number().min(-90).max(90).nullable().optional(),
  dropoffLng: z.number().min(-180).max(180).nullable().optional(),
  dropoffAddress: z.string().trim().max(300).nullable().optional(),
  dropoffPlaceId: z.string().trim().max(80).nullable().optional(),
  dropoffNote: z.string().trim().max(200).nullable().optional(),
  dropoffSource: z
    .enum(["SEARCH", "CURRENT_LOCATION", "MAP_PIN", "SAVED_PLACE", "MANUAL"])
    .nullable()
    .optional(),
  tripNotes: z.string().trim().max(1000).nullable(),
  letStorePlanTrip: z.boolean(),
  preferredVehicleId: z.string().uuid().nullable(),
  placeIds: uuidPlaceIdsSchema,
  itineraryDays: z
    .array(
      z.object({
        dayNumber: z.number().int().min(0).max(30),
        sortOrder: z.number().int().min(0).max(1000),
        kind: z.string().min(1).max(40),
        title: z.string().trim().min(1).max(160),
        location: z.string().trim().max(300).nullable(),
        placeId: z.string().trim().max(80).nullable(),
        note: z.string().trim().max(400).nullable(),
        latitude: z.number().min(-90).max(90).nullable(),
        longitude: z.number().min(-180).max(180).nullable(),
        address: z.string().trim().max(300).nullable(),
        source: z
          .enum(["SEARCH", "CURRENT_LOCATION", "MAP_PIN", "SAVED_PLACE", "MANUAL"])
          .nullable(),
      }),
    )
    .max(120)
    .optional()
    .default([]),
  storeHelpInterests: z.array(z.string().trim().max(40)).max(12).optional().default([]),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(30),
  customerEmail: z
    .union([z.string().email(), z.literal(""), z.null()])
    .transform((value) => value || null),
  customerType: z.enum(CUSTOMER_TYPES),
  companyName: z.string().trim().max(160).nullable(),
  taxId: z.string().trim().max(20).nullable(),
  source: z.enum(BOOKING_SOURCES),
  sessionId: z.string().min(8).max(80),
  referrer: z.string().max(300).nullable(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(80),
});
