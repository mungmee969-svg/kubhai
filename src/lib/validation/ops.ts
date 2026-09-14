import { z } from "zod";
import {
  DRIVER_TYPES,
  OWNERSHIP_TYPES,
  PLACE_CATEGORIES,
  SERVICE_TYPES,
} from "@/lib/domain/enums";
import { STORE_TIP_SURFACES } from "@/lib/domain/store-tips";

export const vehicleSchema = z.object({
  id: z.string().uuid().optional(),
  ownershipType: z.enum(OWNERSHIP_TYPES),
  vehicleType: z.string().trim().min(1).max(40),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  year: z.number().int().min(1990).max(2100).nullable(),
  color: z.string().trim().max(40).nullable(),
  plateNumber: z.string().trim().max(40).nullable(),
  seats: z.number().int().min(1).max(30),
  luggageCapacity: z.number().int().min(0).max(40),
  description: z.string().trim().max(500).nullable(),
  amenities: z.array(z.string().trim().min(1).max(40)).max(20),
  basePrice: z.number().min(0).max(1_000_000).nullable(),
  pricingUnit: z.string().trim().max(20).nullable(),
  imageUrls: z.array(z.string().min(1)).max(8),
  coverImageUrl: z.string().min(1).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]),
  active: z.boolean(),
});

export const driverSchema = z.object({
  id: z.string().uuid().optional(),
  driverType: z.enum(DRIVER_TYPES),
  name: z.string().trim().min(2).max(80),
  nickname: z.string().trim().max(40).nullable(),
  phone: z.string().trim().max(30).nullable(),
  lineId: z.string().trim().max(60).nullable(),
  photoUrl: z.string().trim().max(400).nullable(),
  licenseNumber: z.string().trim().max(40).nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  active: z.boolean(),
});

const optionalCoord = z.number().min(-90).max(90).nullable().optional();
const optionalLng = z.number().min(-180).max(180).nullable().optional();

export const tripPatchSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  pickupLocation: z.string().trim().min(2).max(200).optional(),
  pickupLat: optionalCoord,
  pickupLng: optionalLng,
  pickupAddress: z.string().trim().max(300).nullable().optional(),
  pickupPlaceId: z.string().trim().max(120).nullable().optional(),
  pickupNote: z.string().trim().max(200).nullable().optional(),
  pickupSource: z.string().trim().max(40).nullable().optional(),
  dropoffLocation: z.string().trim().max(200).nullable().optional(),
  dropoffLat: optionalCoord,
  dropoffLng: optionalLng,
  dropoffAddress: z.string().trim().max(300).nullable().optional(),
  dropoffPlaceId: z.string().trim().max(120).nullable().optional(),
  dropoffNote: z.string().trim().max(200).nullable().optional(),
  dropoffSource: z.string().trim().max(40).nullable().optional(),
  locationChangeReason: z.string().trim().max(300).nullable().optional(),
  passengerCount: z.number().int().min(1).max(20).optional(),
  luggageCount: z.number().int().min(0).max(30).nullable().optional(),
  tripNotes: z.string().trim().max(1000).nullable().optional(),
  serviceType: z.enum(SERVICE_TYPES).optional(),
});

export const itinerarySchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  location: z.string().trim().max(200).nullable(),
  dayNumber: z.number().int().min(1).max(30).nullable(),
  estimatedMinutes: z.number().int().min(0).max(24 * 60).nullable(),
  note: z.string().trim().max(400).nullable(),
  placeId: z.string().uuid().nullable(),
  sortOrder: z.number().int().min(0).max(50).optional(),
});

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6})$/, "สีต้องเป็น #RRGGBB")
  .nullable()
  .optional();

export const businessProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  shortName: z.string().trim().max(40).nullable().optional(),
  logoUrl: z.string().trim().max(400).nullable().optional(),
  logoMarkUrl: z.string().trim().max(400).nullable().optional(),
  faviconUrl: z.string().trim().max(400).nullable().optional(),
  coverUrl: z.string().trim().max(400).nullable().optional(),
  bookingHeroImageUrl: z.string().trim().max(400).nullable().optional(),
  bookingMobileHeroImageUrl: z.string().trim().max(400).nullable().optional(),
  bookingTagline: z.string().trim().max(160).nullable().optional(),
  bookingLayoutPreset: z.string().trim().max(40).nullable().optional(),
  bookingThemePreset: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(800).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  lineUrl: z.string().trim().max(200).nullable().optional(),
  facebookUrl: z.string().trim().max(200).nullable().optional(),
  instagramUrl: z.string().trim().max(200).nullable().optional(),
  websiteUrl: z.string().trim().max(200).nullable().optional(),
  email: z
    .union([z.string().email(), z.literal(""), z.null()])
    .transform((v) => v || null)
    .optional(),
  address: z.string().trim().max(200).nullable().optional(),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  textColor: hexColor,
  backgroundColor: hexColor,
  customerSupportText: z.string().trim().max(200).nullable().optional(),
  poweredByKubHaiEnabled: z.boolean().optional(),
});

export const opsSettingsSchema = z.object({
  minAdvanceHours: z.number().int().min(0).max(720).nullable(),
  serviceHours: z.string().trim().max(80).nullable(),
  cancellationPolicy: z.string().trim().max(800).nullable(),
  customerInstructions: z.string().trim().max(800).nullable(),
  overtimeNote: z.string().trim().max(400).nullable(),
  includedHoursPerDay: z.number().min(0).max(24).nullable().optional(),
  overtimeRatePerHour: z.number().min(0).max(100_000).nullable().optional(),
  bankName: z.string().trim().max(80).nullable(),
  bankAccountName: z.string().trim().max(80).nullable(),
  bankAccountNumber: z.string().trim().max(40).nullable(),
  promptpay: z.string().trim().max(40).nullable(),
  quotationPrefix: z.string().trim().max(20).nullable(),
  taxInvoiceName: z.string().trim().max(120).nullable(),
  taxId: z.string().trim().max(20).nullable(),
  defaultDepositPercent: z.number().min(0).max(100).nullable(),
});

export const placeSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.enum(PLACE_CATEGORIES),
  name: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable(),
  address: z.string().trim().max(200).nullable(),
  area: z.string().trim().max(80).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  googlePlaceId: z.string().trim().max(256).nullable().optional(),
  imageUrls: z.array(z.string().min(1)).max(8),
  coverImageUrl: z.string().min(1).nullable().optional(),
  localRecommended: z.boolean(),
  estimatedDurationMinutes: z.number().int().min(0).max(24 * 60).nullable(),
  status: z.enum(["ACTIVE", "HIDDEN"]),
});

export const storeTipSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(80),
  shortText: z.string().trim().min(1).max(240),
  serviceType: z.enum(SERVICE_TYPES).nullable(),
  placeId: z.string().uuid().nullable(),
  locationKeyword: z.string().trim().max(80).nullable(),
  category: z.enum(PLACE_CATEGORIES).nullable(),
  minPassengers: z.number().int().min(1).max(30).nullable(),
  minLuggage: z.number().int().min(0).max(40).nullable(),
  multiDayOnly: z.boolean(),
  active: z.boolean(),
  priority: z.number().int().min(0).max(1000),
  surfaces: z.array(z.enum(STORE_TIP_SURFACES)).max(3),
});

export const storeTipsSchema = z.array(storeTipSchema).max(50);