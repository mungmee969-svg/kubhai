import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { findAssignmentConflict, findAssignmentWarning } from "@/lib/domain/availability";
import { canTransition, isBlockingStatus } from "@/lib/domain/booking-rules";
import { newBookingCode, newId, newSecureToken } from "@/lib/domain/ids";
import {
  applyAcceptedCommercials,
  assertSendable,
  calculateQuotationTotals,
  currentAdminQuotation,
  DEFAULT_QUOTATION_TERMS,
  effectiveQuotationStatus,
  isCustomerVisible,
  isQuotationExpired,
  lineAmount,
  nextQuotationNumber,
  seedQuotationLines,
} from "@/lib/domain/quotation";
import { publicVehicle } from "@/lib/domain/public-view";
import { normalizePlace } from "@/lib/domain/place-normalize";
import { normalizePartnerServiceTypes } from "@/lib/domain/partner-types";
import { sanitizePlaceImages } from "@/lib/domain/place-image";
import {
  BOOKING_APPEARANCE_FIELD_CAPS,
  allowsTripPackages,
  hasBookingCapability,
  planResourceLimitMessage,
  planResourceLimits,
  PLAN_UNLOCK_HINT,
} from "@/lib/domain/booking-entitlements";
import {
  isCustomerVisiblePackage,
  sortFeaturedPackages,
  type TripPackage,
  type TripPackageListFilter,
  type TripPackageStatus,
  type TripPackageUpdateInput,
  type TripPackageWriteInput,
} from "@/lib/domain/trip-package";
import {
  sanitizeBookingMediaUrl,
  sanitizeBookingTagline,
  sanitizeLayoutPreset,
} from "@/lib/domain/booking-appearance-safe";
import type { BookingStatus } from "@/lib/domain/enums";
import type {
  Actor,
  AnalyticsEvent,
  AuditLog,
  Booking,
  BookingItineraryItem,
  BookingNote,
  BusinessUser,
  DriverDayWorkLog,
  DriverJobLink,
  DriverRouteSuggestion,
  MoneyMovement,
  NotificationRead,
  PaymentAccount,
  PaymentProof,
  PaymentProofReviewStatus,
  SlipFile,
  BookingRequestInput,
  Business,
  BusinessSettings,
  Customer,
  Driver,
  Place,
  Quotation,
  QuotationItem,
  StaffInvitation,
  StaffMember,
  Vehicle,
} from "@/lib/domain/types";
import {
  buildDayShell,
  dateForDayNumber,
  elapsedMinutes as calcElapsedMinutes,
  isDriverJobLinkEligible,
  serviceDayCount,
} from "@/lib/domain/driver-job";
import {
  canLinkSocialToAccount,
  isPhoneVerified,
  normalizePhone,
  phonesMatch,
  type CustomerAccount,
  type CustomerIdentity,
  type EarlyCompletionReason,
} from "@/lib/domain/customer-auth";
import {
  assertEarlyCompletionAllowed,
  isEarlyCompletion,
  scheduledEndIso,
} from "@/lib/domain/closeout";
import {
  assertOverrideAllowed,
  distanceMeters,
  proximityBand,
  type CheckInKind,
  type LocationOverrideReason,
  type TripCheckIn,
} from "@/lib/domain/location";
import { assertTripOps } from "@/lib/domain/trip-permissions";
import {
  actorHasPermission,
  buildStaffDirectory,
  createInvitationRecord,
  hashInviteToken,
  membershipPermissions,
  normalizeBusinessUser,
} from "@/lib/data/staff-helpers";
import {
  legacyRoleFromStaffRole,
  permissionsForRole,
  sanitizePermissions,
  STORE_STAFF_ROLES,
  type StorePermission,
  type StoreStaffRole,
} from "@/lib/domain/staff-permissions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  countRecentOtpRequests,
  generateOtpCode,
  hashMatches,
  hashOtpCode,
  isDevOtpEnabled,
  type OtpChallengeRecord,
  type OtpPurpose,
} from "@/lib/auth/otp";
import { getOAuthAdapter, type SocialProvider } from "@/lib/auth/oauth";
import { searchBoard } from "@/lib/domain/ops";
import {
  accountForBooking,
  snapshotAccount,
  validateProofAllocations,
} from "@/lib/domain/payment-accounts";
import { assertAllocationMatch, money, settleBooking } from "@/lib/domain/settlement";
import {
  ConflictError,
  DomainError,
  TenantIsolationError,
  type ApproveProofResult,
  type AssignmentPreview,
  type BookingFinancePlan,
  type BookingRecord,
  type DriverInput,
  type DriverJobAdminSummary,
  type DriverJobRecord,
  type MoneyMovementInput,
  type PaymentAccountInput,
  type PaymentProofSubmitInput,
  type PlaceInput,
  type PublicStore,
  type QuotationDraftInput,
  type QuotationRecord,
  type Store,
  type TenantBoard,
  type TripPatch,
  type VehicleInput,
} from "./repository";
import type { StoreInboxCounts } from "@/lib/domain/types";
import {
  isFixtureBooking,
  isFixtureCustomer,
  isFixtureDriver,
  isFixtureVehicle,
} from "@/lib/domain/fixtures";
import { sniffImage } from "./image-bytes";
import { deletePrivateSlip, readPrivateSlip, writePrivateSlip } from "./private-slips";
import { SEED } from "./seed-ids";
import {
  seedBusinessUsers,
  seedBusinesses,
  seedDomainMappings,
  seedDrivers,
  seedPaymentAccounts,
  seedPlaces,
  seedProfiles,
  seedProvinces,
  seedRegions,
  seedSettings,
  seedTripPackages,
  seedVehicles,
} from "./seed";

type Db = {
  regions: typeof seedRegions;
  provinces: typeof seedProvinces;
  businesses: Business[];
  domainMappings: typeof seedDomainMappings;
  settings: BusinessSettings[];
  vehicles: Vehicle[];
  drivers: Driver[];
  profiles: typeof seedProfiles;
  businessUsers: typeof seedBusinessUsers;
  places: typeof seedPlaces;
  tripPackages: TripPackage[];
  customers: Customer[];
  bookings: Booking[];
  itinerary: BookingItineraryItem[];
  bookingNotes: BookingNote[];
  moneyMovements: MoneyMovement[];
  paymentAccounts: PaymentAccount[];
  paymentProofs: PaymentProof[];
  slipFiles: SlipFile[];
  quotations: Quotation[];
  quotationItems: QuotationItem[];
  analytics: AnalyticsEvent[];
  auditLogs: AuditLog[];
  customerAccounts: CustomerAccount[];
  customerIdentities: CustomerIdentity[];
  otpChallenges: OtpChallengeRecord[];
  tripCheckIns: TripCheckIn[];
  staffInvitations: StaffInvitation[];
  driverJobLinks: DriverJobLink[];
  driverDayLogs: DriverDayWorkLog[];
  driverRouteSuggestions: DriverRouteSuggestion[];
  notificationReads: NotificationRead[];
};

const DB_PATH = path.join(process.cwd(), "data", "local-dev.json");

let writeQueue: Promise<void> = Promise.resolve();

function emptyDb(): Db {
  return {
    regions: seedRegions,
    provinces: seedProvinces,
    businesses: structuredClone(seedBusinesses),
    domainMappings: structuredClone(seedDomainMappings),
    settings: structuredClone(seedSettings),
    vehicles: structuredClone(seedVehicles),
    drivers: structuredClone(seedDrivers),
    profiles: seedProfiles,
    businessUsers: seedBusinessUsers,
    places: seedPlaces,
    tripPackages: structuredClone(seedTripPackages),
    customers: [],
    bookings: [],
    itinerary: [],
    bookingNotes: [],
    moneyMovements: [],
    paymentAccounts: structuredClone(seedPaymentAccounts),
    paymentProofs: [],
    slipFiles: [],
    quotations: [],
    quotationItems: [],
    analytics: [],
    auditLogs: [],
    customerAccounts: [],
    customerIdentities: [],
    otpChallenges: [],
    tripCheckIns: [],
    staffInvitations: [],
    driverJobLinks: [],
    driverDayLogs: [],
    driverRouteSuggestions: [],
    notificationReads: [],
  };
}

function normalizeDb(raw: Partial<Db>): Db {
  const base = emptyDb();
  return {
    ...base,
    ...raw,
    settings: (raw.settings ?? base.settings).map((item) => ({
      ...item,
      tips:
        Array.isArray(item.tips) && item.tips.length > 0
          ? item.tips
          : (seedSettings.find((seed) => seed.businessId === item.businessId)?.tips ?? []),
      ops: item.ops ?? null,
    })),
    vehicles: (raw.vehicles ?? base.vehicles).map((item) => ({
      ...item,
      coverImageUrl: (item as Vehicle).coverImageUrl ?? item.imageUrls?.[0] ?? null,
      imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls : [],
    })),
    drivers: raw.drivers ?? base.drivers,
    businessUsers: (raw.businessUsers ?? base.businessUsers).map((item) =>
      normalizeBusinessUser(item as BusinessUser),
    ),
    businesses: (raw.businesses ?? base.businesses).map((item) => ({
      ...item,
      shortName: item.shortName ?? null,
      logoMarkUrl: item.logoMarkUrl ?? null,
      faviconUrl: item.faviconUrl ?? null,
      bookingHeroImageUrl: (item as Business).bookingHeroImageUrl ?? null,
      bookingMobileHeroImageUrl: (item as Business).bookingMobileHeroImageUrl ?? null,
      bookingTagline: (item as Business).bookingTagline ?? null,
      bookingLayoutPreset: (item as Business).bookingLayoutPreset ?? null,
      bookingThemePreset: (item as Business).bookingThemePreset ?? null,
      primaryColor: item.primaryColor ?? null,
      secondaryColor: item.secondaryColor ?? null,
      accentColor: item.accentColor ?? null,
      textColor: item.textColor ?? null,
      backgroundColor: item.backgroundColor ?? null,
      customerSupportText: item.customerSupportText ?? null,
      poweredByKubHaiEnabled: item.poweredByKubHaiEnabled !== false,
      subscriptionPlan: item.subscriptionPlan ?? "partner",
      partnerServiceTypes: normalizePartnerServiceTypes(
        (item as Business).partnerServiceTypes ??
          (item.slug === "pondcarrent"
            ? ["CHAUFFEUR", "AIRPORT_TRANSFER", "POINT_TO_POINT", "MULTI_DAY_DRIVER", "TOUR_TRANSPORT"]
            : ["CHAUFFEUR"]),
      ),
      commercialModel: (item as Business).commercialModel === "INSTANT_PRICE" ? "INSTANT_PRICE" : "QUOTE_FIRST",
    })),
    customers: raw.customers ?? [],
    places: (() => {
      const seedById = new Map(seedPlaces.map((item) => [item.id, item]));
      const incoming = raw.places?.length ? raw.places : base.places;
      const seen = new Set<string>();
      const merged = incoming.map((item) => {
        seen.add(item.id);
        const seed = seedById.get(item.id);
        // Keep curated seed content authoritative for seed place IDs
        return normalizePlace(seed ? { ...item, ...seed } : (item as Place));
      });
      for (const seed of seedPlaces) {
        if (!seen.has(seed.id)) merged.push(normalizePlace(seed));
      }
      return merged;
    })(),
    tripPackages: (() => {
      const seedById = new Map(seedTripPackages.map((item) => [item.id, item]));
      const incoming = Array.isArray(raw.tripPackages) ? raw.tripPackages : base.tripPackages;
      const seen = new Set<string>();
      const merged = incoming.map((item) => {
        seen.add(item.id);
        const seed = seedById.get(item.id);
        return (seed ? { ...item, ...seed } : item) as TripPackage;
      });
      for (const seed of seedTripPackages) {
        if (!seen.has(seed.id)) merged.push(structuredClone(seed));
      }
      return merged;
    })(),
    bookings: (raw.bookings ?? []).map((item) => ({
      ...item,
      driverFeeAmount: item.driverFeeAmount ?? null,
      receivingAccountId: item.receivingAccountId ?? null,
      acceptedQuotationId: item.acceptedQuotationId ?? null,
      customerAccountId: item.customerAccountId ?? null,
      pickupAddress: item.pickupAddress ?? null,
      pickupPlaceId: item.pickupPlaceId ?? null,
      pickupNote: item.pickupNote ?? null,
      pickupSource: item.pickupSource ?? null,
      dropoffAddress: item.dropoffAddress ?? null,
      dropoffPlaceId: item.dropoffPlaceId ?? null,
      dropoffNote: item.dropoffNote ?? null,
      dropoffSource: item.dropoffSource ?? null,
      actualStartAt: item.actualStartAt ?? null,
      pickupCheckedInAt: item.pickupCheckedInAt ?? null,
      dropoffCheckedInAt: item.dropoffCheckedInAt ?? null,
      actualEndAt: item.actualEndAt ?? null,
      scheduledEndAtSnapshot: item.scheduledEndAtSnapshot ?? null,
      earlyCompletionReason: item.earlyCompletionReason ?? null,
      earlyCompletionNote: item.earlyCompletionNote ?? null,
      completedByUserId: item.completedByUserId ?? null,
      completedAt: item.completedAt ?? null,
    })),
    itinerary: (raw.itinerary ?? []).map((item) => ({
      ...item,
      location: item.location ?? null,
      dayNumber: item.dayNumber ?? null,
      estimatedMinutes: item.estimatedMinutes ?? null,
      kind: item.kind ?? null,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      address: item.address ?? item.location ?? null,
      source: item.source ?? null,
    })),
    bookingNotes: (raw.bookingNotes ?? []).map((item) => ({
      ...item,
      audience: item.audience === "CUSTOMER" ? "CUSTOMER" : "INTERNAL",
      title: item.title ?? null,
    })),
    customerAccounts: raw.customerAccounts ?? [],
    customerIdentities: raw.customerIdentities ?? [],
    otpChallenges: raw.otpChallenges ?? [],
    tripCheckIns: raw.tripCheckIns ?? [],
    staffInvitations: raw.staffInvitations ?? [],
    driverJobLinks: raw.driverJobLinks ?? [],
    driverDayLogs: raw.driverDayLogs ?? [],
    driverRouteSuggestions: raw.driverRouteSuggestions ?? [],
    notificationReads: raw.notificationReads ?? [],
    moneyMovements: (raw.moneyMovements ?? []).map((item) => {
      const accounts = raw.paymentAccounts?.length ? raw.paymentAccounts : seedPaymentAccounts;
      const receiving =
        item.receivingAccountSnapshot ??
        (item.receivingAccountId
          ? (() => {
              const account = accounts.find((row) => row.id === item.receivingAccountId);
              return account ? snapshotAccount(account) : null;
            })()
          : null);
      const source =
        item.sourceAccountSnapshot ??
        (item.sourceAccountId
          ? (() => {
              const account = accounts.find((row) => row.id === item.sourceAccountId);
              return account ? snapshotAccount(account) : null;
            })()
          : null);
      return {
        ...item,
        paymentProofId: item.paymentProofId ?? null,
        receivingAccountId: item.receivingAccountId ?? null,
        receivingAccountSnapshot: receiving,
        sourceAccountId: item.sourceAccountId ?? null,
        sourceAccountSnapshot: source,
        legacyAccountUnknown: item.legacyAccountUnknown ?? (!receiving && !source),
      };
    }),
    paymentAccounts: (raw.paymentAccounts?.length ? raw.paymentAccounts : seedPaymentAccounts).map((item) => ({
      ...item,
      qrImagePath:
        item.id === SEED.accountPondScb && !item.qrImagePath ? "/brand/pond-qr-configured.svg" : item.qrImagePath,
      qrDisplayEnabled: item.qrDisplayEnabled ?? Boolean(item.qrImagePath || item.id === SEED.accountPondScb),
    })),
    paymentProofs: raw.paymentProofs ?? [],
    slipFiles: raw.slipFiles ?? [],
    quotations: (raw.quotations ?? []).map((rawItem) => {
      const item = rawItem as Quotation & {
        discount?: number;
        total?: number;
        depositRequired?: number;
        notes?: string | null;
      };
      const legacyStatus = String((rawItem as { status?: string }).status ?? item.status);
      const totalAmount = item.totalAmount ?? item.total ?? 0;
      const depositRequiredAmount = item.depositRequiredAmount ?? item.depositRequired ?? 0;
      const status =
        legacyStatus === "ACCEPTED"
          ? "CUSTOMER_ACCEPTED"
          : legacyStatus === "REJECTED"
            ? "CUSTOMER_REJECTED"
            : legacyStatus === "REVISION_REQUESTED"
              ? "CUSTOMER_CHANGE_REQUESTED"
              : item.status;
      return {
        ...item,
        version: item.version ?? 1,
        currency: "THB" as const,
        discountAmount: item.discountAmount ?? item.discount ?? 0,
        totalAmount,
        depositType: item.depositType ?? (depositRequiredAmount ? "FIXED_AMOUNT" : "NONE"),
        depositValue: item.depositValue ?? depositRequiredAmount,
        depositRequiredAmount,
        balanceAmount: item.balanceAmount ?? Math.max(0, totalAmount - depositRequiredAmount),
        note: item.note ?? item.notes ?? null,
        terms: item.terms ?? null,
        changeRequestText: item.changeRequestText ?? null,
        changeRequestedAt: item.changeRequestedAt ?? null,
        rejectReason: item.rejectReason ?? null,
        createdBy: item.createdBy ?? null,
        status,
      };
    }),
    quotationItems: raw.quotationItems ?? [],
    analytics: raw.analytics ?? [],
    auditLogs: raw.auditLogs ?? [],
  };
}

async function readDb(): Promise<Db> {
  try {
    const raw = await readFile(DB_PATH, "utf8");
    return normalizeDb(JSON.parse(raw) as Partial<Db>);
  } catch {
    const fresh = emptyDb();
    await persist(fresh);
    return fresh;
  }
}

async function persist(db: Db): Promise<void> {
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function mutate<T>(fn: (db: Db) => T): Promise<T> {
  const run = writeQueue.then(async () => {
    const db = await readDb();
    const result = fn(db);
    await persist(db);
    return result;
  });
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isSuper(actor: Actor): boolean {
  return actor.kind === "user" && actor.role === "SUPER_ADMIN";
}

function assertBusinessAccess(actor: Actor, businessId: string): void {
  if (
    actor.kind === "public" ||
    actor.kind === "booking_token" ||
    actor.kind === "customer" ||
    actor.kind === "driver_job"
  ) {
    throw new TenantIsolationError();
  }
  if (isSuper(actor)) return;
  if (!actor.businessIds.includes(businessId)) {
    throw new TenantIsolationError();
  }
}

function assertBookingActor(actor: Actor, booking: Booking): void {
  if (actor.kind === "booking_token") {
    if (actor.token !== booking.securePublicToken) throw new TenantIsolationError();
    return;
  }
  if (actor.kind === "customer") {
    if (booking.customerAccountId !== actor.customerAccountId) {
      throw new TenantIsolationError("ไม่มีสิทธิ์เข้าถึงการจองนี้");
    }
    return;
  }
  assertBusinessAccess(actor, booking.businessId);
}

function accountByIdAuth(db: Db, id: string): CustomerAccount | null {
  return db.customerAccounts.find((item) => item.id === id) ?? null;
}

function requireVerifiedCustomerAccount(db: Db, customerAccountId: string): CustomerAccount {
  const account = accountByIdAuth(db, customerAccountId);
  if (!account || account.status !== "ACTIVE") throw new DomainError("ไม่พบบัญชีลูกค้า");
  if (!isPhoneVerified(account)) {
    throw new DomainError("ยืนยันเบอร์โทรเพื่อทำการจอง");
  }
  return account;
}

function accountsOf(db: Db, businessId: string) {
  return db.paymentAccounts.filter((item) => item.businessId === businessId);
}

function accountById(db: Db, businessId: string, accountId: string | null | undefined) {
  if (!accountId) return null;
  return db.paymentAccounts.find((item) => item.id === accountId && item.businessId === businessId) ?? null;
}

function applyMoneySnapshot(booking: Booking, db: Db) {
  const snapshot = settleBooking(
    booking,
    db.moneyMovements.filter((item) => item.bookingId === booking.id),
  );
  booking.paidAmount = snapshot.customerPaidTotal;
  booking.balanceAmount = snapshot.remainingBalance;
  booking.updatedAt = stamp();
}

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function stamp(): string {
  return new Date().toISOString();
}

function audit(
  db: Db,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string | null,
  businessId: string | null,
  metadata: Record<string, unknown> = {},
) {
  db.auditLogs.push({
    id: newId(),
    businessId,
    actorUserId: actor.kind === "user" ? actor.userId : null,
    action,
    entityType,
    entityId,
    metadata: {
      ...metadata,
      ...(actor.kind === "customer" ? { customerAccountId: actor.customerAccountId } : {}),
      ...(actor.kind === "driver_job" ? { driverJobLinkId: actor.jobLinkId } : {}),
    },
    createdAt: stamp(),
  });
}

export class LocalStore implements Store {
  async getPublicStore(slug: string): Promise<PublicStore | null> {
    const db = await readDb();
    const business = db.businesses.find(
      (item) => item.slug === slug && item.status === "ACTIVE",
    );
    if (!business) return null;
    return {
      business,
      settings: db.settings.find((item) => item.businessId === business.id) ?? null,
      vehicles: db.vehicles
        .filter(
          (item) =>
            item.businessId === business.id &&
            item.active &&
            item.status === "ACTIVE",
        )
        .map(publicVehicle),
      places: db.places.filter(
        (item) =>
          item.status === "ACTIVE" &&
          (item.businessId === business.id || item.businessId === null) &&
          item.provinceId === business.provinceId,
      ),
      region: db.regions.find((item) => item.id === business.regionId) ?? null,
      province:
        db.provinces.find((item) => item.id === business.provinceId) ?? null,
    };
  }

  async listPublicPlaces(opts?: {
    provinceSlug?: string | null;
    category?: string | null;
  }): Promise<Place[]> {
    const db = await readDb();
    let provinceId: string | null = null;
    if (opts?.provinceSlug) {
      provinceId = db.provinces.find((item) => item.slug === opts.provinceSlug)?.id ?? null;
    }
    return db.places.filter((item) => {
      if (item.status !== "ACTIVE") return false;
      if (provinceId && item.provinceId !== provinceId) return false;
      return true;
    });
  }

  async getPublicPlaceBySlug(slug: string): Promise<{
    place: Place;
    province: { id: string; nameTh: string; slug: string } | null;
  } | null> {
    const db = await readDb();
    const place = db.places.find((item) => item.slug === slug && item.status === "ACTIVE");
    if (!place) return null;
    const province = db.provinces.find((item) => item.id === place.provinceId) ?? null;
    return {
      place,
      province: province
        ? { id: province.id, nameTh: province.nameTh, slug: province.slug }
        : null,
    };
  }

  async getVehicle(businessId: string, vehicleId: string) {
    const db = await readDb();
    return (
      db.vehicles.find(
        (item) => item.id === vehicleId && item.businessId === businessId,
      ) ?? null
    );
  }

  async listVehicles(actor: Actor, businessId: string) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.vehicles.filter((item) => item.businessId === businessId);
  }

  async listDrivers(actor: Actor, businessId: string) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.drivers.filter((item) => item.businessId === businessId);
  }

  async createBookingRequest(input: BookingRequestInput) {
    return mutate((db) => {
      const business = db.businesses.find(
        (item) => item.slug === input.businessSlug && item.status === "ACTIVE",
      );
      if (!business) throw new DomainError("ไม่พบร้านนี้");

      const existing = db.bookings.find(
        (item) =>
          item.businessId === business.id &&
          item.clientRequestId === input.clientRequestId,
      );
      if (existing) return { booking: existing, reused: true };

      if (input.preferredVehicleId) {
        const vehicle = db.vehicles.find(
          (item) =>
            item.id === input.preferredVehicleId &&
            item.businessId === business.id &&
            item.active,
        );
        if (!vehicle) throw new DomainError("รถที่เลือกไม่อยู่ในร้านนี้");
      }

      const createdAt = stamp();
      let customer = db.customers.find((item) => {
        if (item.businessId !== business.id) return false;
        if (!item.phone || item.phone !== input.customerPhone) return false;
        if (item.email && input.customerEmail && item.email !== input.customerEmail) {
          return false;
        }
        return true;
      });
      if (!customer) {
        customer = {
          id: newId(),
          businessId: business.id,
          customerType: input.customerType,
          name: input.customerName,
          phone: input.customerPhone,
          email: input.customerEmail,
          companyName: input.companyName,
          taxId: input.taxId,
          branchType: input.customerType === "COMPANY" ? "HQ" : null,
          branchNumber: null,
          taxInvoiceAddress: null,
          invoiceEmail: input.customerEmail,
          createdAt,
          updatedAt: createdAt,
        };
        db.customers.push(customer);
      }

      const booking: Booking = {
        id: newId(),
        businessId: business.id,
        bookingCode: newBookingCode(),
        securePublicToken: newSecureToken(),
        clientRequestId: input.clientRequestId,
        customerId: customer.id,
        customerAccountId: (() => {
          const phone = normalizePhone(input.customerPhone);
          const account = db.customerAccounts.find(
            (item) =>
              item.status === "ACTIVE" &&
              item.phoneNormalized === phone &&
              Boolean(item.phoneVerifiedAt),
          );
          return account?.id ?? null;
        })(),
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
        pickupSource: input.pickupSource ?? (input.pickupLat != null ? "SEARCH" : "MANUAL"),
        dropoffLocation: input.dropoffLocation,
        dropoffLat: input.dropoffLat ?? null,
        dropoffLng: input.dropoffLng ?? null,
        dropoffAddress: input.dropoffAddress ?? null,
        dropoffPlaceId: input.dropoffPlaceId ?? null,
        dropoffNote: input.dropoffNote ?? null,
        dropoffSource: input.dropoffSource ?? (input.dropoffLat != null ? "SEARCH" : "MANUAL"),
        tripNotes: input.tripNotes,
        letStorePlanTrip: input.letStorePlanTrip,
        preferredVehicleId: input.preferredVehicleId,
        assignedVehicleId: null,
        assignedDriverId: null,
        status: "REQUESTED",
        quotedTotal: null,
        depositAmount: null,
        paidAmount: 0,
        balanceAmount: null,
        driverFeeAmount: null,
        receivingAccountId: accountForBooking(null, accountsOf(db, business.id))?.id ?? null,
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
        createdAt,
        updatedAt: createdAt,
      };
      db.bookings.push(booking);

      input.placeIds.forEach((placeId, index) => {
        const place = db.places.find((item) => item.id === placeId);
        if (!place) return;
        db.itinerary.push({
          id: newId(),
          bookingId: booking.id,
          businessId: business.id,
          placeId: place.id,
          title: place.name,
          location: place.address,
          dayNumber: 1,
          estimatedMinutes: place.estimatedDurationMinutes,
          note: null,
          sortOrder: index,
          kind: "STOP",
          latitude: place.latitude,
          longitude: place.longitude,
          address: place.address,
          source: "SAVED_PLACE",
        });
      });

      const dayItems = input.itineraryDays ?? [];
      if (dayItems.length) {
        // Prefer structured day plan over flat placeIds when provided
        db.itinerary = db.itinerary.filter((row) => row.bookingId !== booking.id);
        for (const row of dayItems) {
          db.itinerary.push({
            id: newId(),
            bookingId: booking.id,
            businessId: business.id,
            placeId: row.placeId,
            title: row.title,
            location: row.location ?? row.address,
            dayNumber: row.dayNumber,
            estimatedMinutes: null,
            note: row.note,
            sortOrder: row.sortOrder,
            kind: row.kind,
            latitude: row.latitude,
            longitude: row.longitude,
            address: row.address ?? row.location,
            source: row.source,
          });
        }
      }

      db.analytics.push({
        id: newId(),
        businessId: business.id,
        sessionId: input.sessionId,
        customerId: customer.id,
        bookingId: booking.id,
        eventName: "booking_submitted",
        eventData: {
          serviceType: input.serviceType,
          placeCount: input.placeIds.length,
        },
        source: input.source,
        referrer: input.referrer,
        createdAt,
      });

      return { booking, reused: false };
    });
  }

  async getBookingByToken(token: string): Promise<BookingRecord | null> {
    if (!token || token.length < 20) return null;
    const db = await readDb();
    const booking = db.bookings.find((item) => item.securePublicToken === token);
    if (!booking) return null;
    return hydrateBooking(db, booking);
  }

  async getBookingById(actor: Actor, bookingId: string) {
    const db = await readDb();
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) return null;
    try {
      if (actor.kind === "customer") {
        assertBookingActor(actor, booking);
      } else {
        assertBusinessAccess(actor, booking.businessId);
      }
    } catch (error) {
      if (error instanceof TenantIsolationError) return null;
      throw error;
    }
    return hydrateBooking(db, booking);
  }

  async listBookings(
    actor: Actor,
    businessId: string,
    filter?: { status?: BookingStatus | "TODAY" | "NO_VEHICLE" | "NO_DRIVER" },
  ) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    let rows = db.bookings.filter((item) => item.businessId === businessId);
    const today = todayBangkok();
    if (filter?.status === "TODAY") {
      rows = rows.filter((item) => item.startDate === today);
    } else if (filter?.status === "NO_VEHICLE") {
      rows = rows.filter(
        (item) =>
          !item.assignedVehicleId &&
          item.status !== "CANCELLED" &&
          item.status !== "REJECTED",
      );
    } else if (filter?.status === "NO_DRIVER") {
      rows = rows.filter(
        (item) =>
          !item.assignedDriverId &&
          item.status !== "CANCELLED" &&
          item.status !== "REJECTED",
      );
    } else if (filter?.status) {
      rows = rows.filter((item) => item.status === filter.status);
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async inboxCounts(actor: Actor, businessId: string): Promise<StoreInboxCounts> {
    const bookings = await this.listBookings(actor, businessId);
    const today = todayBangkok();
    const open = (status: BookingStatus) =>
      bookings.filter((item) => item.status === status).length;
    return {
      REQUESTED: open("REQUESTED"),
      CHECKING_AVAILABILITY: open("CHECKING_AVAILABILITY"),
      AVAILABLE: open("AVAILABLE"),
      QUOTATION_SENT: open("QUOTATION_SENT"),
      CUSTOMER_CONFIRMED: open("CUSTOMER_CONFIRMED"),
      WAITING_DEPOSIT: open("WAITING_DEPOSIT"),
      CONFIRMED: open("CONFIRMED"),
      IN_PROGRESS: open("IN_PROGRESS"),
      COMPLETED: open("COMPLETED"),
      CANCELLED: open("CANCELLED"),
      todayJobs: bookings.filter((item) => item.startDate === today).length,
      unassignedVehicle: bookings.filter(
        (item) =>
          !item.assignedVehicleId &&
          item.status !== "CANCELLED" &&
          item.status !== "REJECTED",
      ).length,
      unassignedDriver: bookings.filter(
        (item) =>
          !item.assignedDriverId &&
          item.status !== "CANCELLED" &&
          item.status !== "REJECTED",
      ).length,
    };
  }

  async updateBookingStatus(
    actor: Actor,
    bookingId: string,
    status: BookingStatus,
    opts?: { reason?: string | null },
  ) {
    if (status === "COMPLETED") {
      throw new DomainError("ใช้ completeBooking สำหรับจบงาน");
    }
    if (status === "CANCELLED" && !opts?.reason?.trim()) {
      throw new DomainError("กรุณาระบุเหตุผลยกเลิก");
    }
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      if (!canTransition(booking.status, status)) {
        throw new DomainError("เปลี่ยนสถานะนี้ไม่ได้");
      }
      if (isBlockingStatus(status)) {
        const conflict = findAssignmentConflict({
          bookings: db.bookings.filter((item) => item.businessId === booking.businessId),
          vehicleId: booking.assignedVehicleId,
          driverId: booking.assignedDriverId,
          range: booking,
          ignoreBookingId: booking.id,
        });
        if (conflict.vehicle) {
          throw new ConflictError("รถคันนี้มีงานที่ยืนยันแล้วทับช่วงวันเดียวกัน");
        }
        if (conflict.driver) {
          throw new ConflictError("คนขับคนนี้มีงานที่ยืนยันแล้วทับช่วงวันเดียวกัน");
        }
      }
      booking.status = status;
      booking.updatedAt = stamp();
      if (status === "CANCELLED") {
        const now = stamp();
        for (const link of db.driverJobLinks) {
          if (link.bookingId === booking.id && link.status === "ACTIVE") {
            link.status = "REVOKED";
            link.revokedAt = now;
            link.updatedAt = now;
            audit(db, actor, "driver_job.revoked", "driver_job_link", link.id, booking.businessId, {
              bookingId: booking.id,
              driverId: link.driverId,
              reason: "booking_cancelled",
            });
          }
        }
      } else if (
        booking.assignedDriverId &&
        isDriverJobLinkEligible(booking, db.paymentProofs, booking.id)
      ) {
        const now = stamp();
        const existing = db.driverJobLinks.find(
          (item) =>
            item.bookingId === booking.id &&
            item.status === "ACTIVE" &&
            item.driverId === booking.assignedDriverId,
        );
        if (!existing) {
          for (const link of db.driverJobLinks) {
            if (link.bookingId === booking.id && link.status === "ACTIVE") {
              link.status = "REVOKED";
              link.revokedAt = now;
              link.updatedAt = now;
              audit(db, actor, "driver_job.revoked", "driver_job_link", link.id, booking.businessId, {
                bookingId: booking.id,
                driverId: link.driverId,
                reason: "superseded_on_confirm",
              });
            }
          }
          const link: DriverJobLink = {
            id: newId(),
            businessId: booking.businessId,
            bookingId: booking.id,
            driverId: booking.assignedDriverId,
            vehicleId: booking.assignedVehicleId,
            secureToken: newSecureToken(),
            status: "ACTIVE",
            issuedAt: now,
            revokedAt: null,
            firstOpenedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          db.driverJobLinks.push(link);
          audit(db, actor, "driver_job.issued", "driver_job_link", link.id, booking.businessId, {
            bookingId: booking.id,
            driverId: link.driverId,
            vehicleId: link.vehicleId,
            trigger: "status_confirmed",
          });
        }
      }
      audit(db, actor, "booking.status_update", "booking", booking.id, booking.businessId, {
        status,
        reason: opts?.reason?.trim() || null,
      });
      return booking;
    });
  }

  /**
   * Operational job completion. Does NOT financially close the booking.
   * Early completion requires a reason; accepted quotation totals are never changed here.
   */
  async completeBooking(
    actor: Actor,
    bookingId: string,
    input: {
      earlyCompletionReason?: EarlyCompletionReason | null;
      earlyCompletionNote?: string | null;
      now?: string | null;
      acknowledgeOutstanding?: boolean;
    } = {},
  ) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);

      // Idempotent: already completed
      if (booking.status === "COMPLETED") {
        return booking;
      }
      if (!canTransition(booking.status, "COMPLETED")) {
        throw new DomainError("เปลี่ยนสถานะนี้ไม่ได้");
      }

      const nowMs = input.now ? Date.parse(input.now) : Date.now();
      const nowIso = input.now ?? new Date(nowMs).toISOString();
      try {
        assertEarlyCompletionAllowed(booking, input, nowMs);
      } catch (error) {
        throw new DomainError(error instanceof Error ? error.message : "จบงานไม่สำเร็จ");
      }

      const early = isEarlyCompletion(booking, nowMs);
      const quotedBefore = booking.quotedTotal;
      const acceptedBefore = booking.acceptedQuotationId;

      booking.status = "COMPLETED";
      booking.actualEndAt = nowIso;
      booking.scheduledEndAtSnapshot = scheduledEndIso(booking);
      booking.earlyCompletionReason = early ? (input.earlyCompletionReason ?? null) : null;
      booking.earlyCompletionNote =
        early && input.earlyCompletionReason === "OTHER"
          ? (input.earlyCompletionNote?.trim() ?? null)
          : early
            ? (input.earlyCompletionNote?.trim() ?? null)
            : null;
      booking.completedByUserId = actor.kind === "user" ? actor.userId : null;
      booking.completedAt = nowIso;
      booking.updatedAt = nowIso;

      // Hard protection: never mutate commercial totals on closeout
      booking.quotedTotal = quotedBefore;
      booking.acceptedQuotationId = acceptedBefore;

      audit(
        db,
        actor,
        early ? "BOOKING_COMPLETED_EARLY" : "BOOKING_COMPLETED",
        "booking",
        booking.id,
        booking.businessId,
        {
          status: "COMPLETED",
          early,
          earlyCompletionReason: booking.earlyCompletionReason,
          earlyCompletionNote: booking.earlyCompletionNote,
          scheduledEndAtSnapshot: booking.scheduledEndAtSnapshot,
          actualEndAt: booking.actualEndAt,
          quotedTotalUnchanged: booking.quotedTotal,
          acknowledgeOutstanding: Boolean(input.acknowledgeOutstanding),
        },
      );
      return booking;
    });
  }

  async assignBooking(
    actor: Actor,
    bookingId: string,
    input: { vehicleId?: string | null; driverId?: string | null },
  ) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);

      if (input.vehicleId) {
        const vehicle = db.vehicles.find(
          (item) =>
            item.id === input.vehicleId && item.businessId === booking.businessId,
        );
        if (!vehicle) throw new TenantIsolationError("รถไม่อยู่ในร้านนี้");
      }
      if (input.driverId) {
        const driver = db.drivers.find(
          (item) =>
            item.id === input.driverId && item.businessId === booking.businessId,
        );
        if (!driver) throw new TenantIsolationError("คนขับไม่อยู่ในร้านนี้");
      }

      const nextVehicle =
        input.vehicleId === undefined ? booking.assignedVehicleId : input.vehicleId;
      const nextDriver =
        input.driverId === undefined ? booking.assignedDriverId : input.driverId;

      if (isBlockingStatus(booking.status)) {
        const conflict = findAssignmentConflict({
          bookings: db.bookings.filter((item) => item.businessId === booking.businessId),
          vehicleId: nextVehicle,
          driverId: nextDriver,
          range: booking,
          ignoreBookingId: booking.id,
        });
        if (conflict.vehicle) throw new ConflictError("รถคันนี้มีงานที่ยืนยันแล้วทับช่วงวันเดียวกัน");
        if (conflict.driver) throw new ConflictError("คนขับคนนี้มีงานที่ยืนยันแล้วทับช่วงวันเดียวกัน");
      }

      booking.assignedVehicleId = nextVehicle ?? null;
      booking.assignedDriverId = nextDriver ?? null;
      booking.updatedAt = stamp();
      audit(db, actor, "booking.assign", "booking", booking.id, booking.businessId, {
        vehicleId: booking.assignedVehicleId,
        driverId: booking.assignedDriverId,
      });

      if (input.driverId !== undefined) {
        const now = stamp();
        const proofs = db.paymentProofs.filter((item) => item.bookingId === booking.id);
        const eligible = isDriverJobLinkEligible(booking, proofs, booking.id);

        for (const link of db.driverJobLinks) {
          if (link.bookingId === booking.id && link.status === "ACTIVE") {
            // Keep same driver link when still eligible (idempotent)
            if (eligible && nextDriver && link.driverId === nextDriver) {
              link.vehicleId = booking.assignedVehicleId;
              link.updatedAt = now;
              continue;
            }
            link.status = "REVOKED";
            link.revokedAt = now;
            link.updatedAt = now;
            audit(db, actor, "driver_job.revoked", "driver_job_link", link.id, booking.businessId, {
              bookingId: booking.id,
              driverId: link.driverId,
              reason: nextDriver ? "reassigned" : "unassigned",
            });
          }
        }

        // Mint only when deposit/ops confirmed AND driver assigned
        if (nextDriver && eligible) {
          const existing = db.driverJobLinks.find(
            (item) =>
              item.bookingId === booking.id &&
              item.status === "ACTIVE" &&
              item.driverId === nextDriver,
          );
          if (!existing) {
            const link: DriverJobLink = {
              id: newId(),
              businessId: booking.businessId,
              bookingId: booking.id,
              driverId: nextDriver,
              vehicleId: booking.assignedVehicleId,
              secureToken: newSecureToken(),
              status: "ACTIVE",
              issuedAt: now,
              revokedAt: null,
              firstOpenedAt: null,
              createdAt: now,
              updatedAt: now,
            };
            db.driverJobLinks.push(link);
            audit(db, actor, "driver_job.issued", "driver_job_link", link.id, booking.businessId, {
              bookingId: booking.id,
              driverId: link.driverId,
              vehicleId: link.vehicleId,
            });
          }
        }
      }

      return booking;
    });
  }

  async getDriverJobByToken(token: string): Promise<DriverJobRecord | null> {
    if (!token || token.length < 20) return null;
    const db = await readDb();
    return hydrateDriverJob(db, token);
  }

  async openDriverJob(token: string): Promise<DriverJobRecord | null> {
    if (!token || token.length < 20) return null;
    return mutate((db) => {
      const link = db.driverJobLinks.find(
        (item) => item.secureToken === token && item.status === "ACTIVE",
      );
      if (!link) return null;
      if (!link.firstOpenedAt) {
        const now = stamp();
        link.firstOpenedAt = now;
        link.updatedAt = now;
        audit(
          db,
          { kind: "driver_job", token, jobLinkId: link.id },
          "driver_job.opened",
          "driver_job_link",
          link.id,
          link.businessId,
          { bookingId: link.bookingId },
        );
      }
      return hydrateDriverJob(db, token);
    });
  }

  async startDriverDay(token: string, dayNumber: number): Promise<DriverJobRecord> {
    return mutate((db) => {
      const ctx = requireActiveDriverJob(db, token);
      const { link, booking, actor } = ctx;
      const days = serviceDayCount(booking);
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > days) {
        throw new DomainError("หมายเลขวันไม่ถูกต้อง");
      }
      let log = db.driverDayLogs.find(
        (item) => item.driverJobLinkId === link.id && item.dayNumber === dayNumber,
      );
      if (log?.startedAt) {
        throw new DomainError("วันนี้เริ่มงานแล้ว");
      }
      const now = stamp();
      const dayDate = dateForDayNumber(booking, dayNumber);
      if (!log) {
        log = {
          id: newId(),
          businessId: booking.businessId,
          bookingId: booking.id,
          driverJobLinkId: link.id,
          driverId: link.driverId,
          dayNumber,
          dayDate,
          startedAt: now,
          endedAt: null,
          elapsedMinutes: null,
          startedBy: "DRIVER",
          endedBy: null,
          overrideReason: null,
          createdAt: now,
          updatedAt: now,
        };
        db.driverDayLogs.push(log);
      } else {
        log.startedAt = now;
        log.startedBy = "DRIVER";
        log.updatedAt = now;
      }

      if (
        dayNumber === 1 &&
        booking.status === "CONFIRMED" &&
        canTransition(booking.status, "IN_PROGRESS")
      ) {
        booking.status = "IN_PROGRESS";
        if (!booking.actualStartAt) booking.actualStartAt = now;
        booking.updatedAt = now;
      }

      audit(db, actor, "driver_job.day_started", "driver_day_log", log.id, booking.businessId, {
        bookingId: booking.id,
        dayNumber,
        dayDate,
      });
      const record = hydrateDriverJob(db, token);
      if (!record) throw new DomainError("ไม่พบลิงก์งานคนขับ");
      return record;
    });
  }

  async endDriverDay(token: string, dayNumber: number): Promise<DriverJobRecord> {
    return mutate((db) => {
      const ctx = requireActiveDriverJob(db, token);
      const { link, booking, actor } = ctx;
      const days = serviceDayCount(booking);
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > days) {
        throw new DomainError("หมายเลขวันไม่ถูกต้อง");
      }
      const log = db.driverDayLogs.find(
        (item) => item.driverJobLinkId === link.id && item.dayNumber === dayNumber,
      );
      if (!log?.startedAt) {
        throw new DomainError("ยังไม่ได้เริ่มวันนี้");
      }
      if (log.endedAt) {
        throw new DomainError("วันนี้จบงานแล้ว");
      }
      const now = stamp();
      log.endedAt = now;
      log.elapsedMinutes = calcElapsedMinutes(log.startedAt, now);
      log.endedBy = "DRIVER";
      log.updatedAt = now;

      const shell = buildDayShell(booking);
      const allDone = shell.every((day) => {
        const row = db.driverDayLogs.find(
          (item) => item.driverJobLinkId === link.id && item.dayNumber === day.dayNumber,
        );
        return Boolean(row?.endedAt);
      });

      // Operational completion only — never fake early-closeout reasons / finance.
      if (
        allDone &&
        canTransition(booking.status, "COMPLETED") &&
        !isEarlyCompletion(booking)
      ) {
        booking.status = "COMPLETED";
        booking.actualEndAt = now;
        booking.scheduledEndAtSnapshot = scheduledEndIso(booking);
        booking.completedAt = now;
        booking.completedByUserId = null;
        booking.earlyCompletionReason = null;
        booking.earlyCompletionNote = null;
        booking.updatedAt = now;
        audit(db, actor, "BOOKING_COMPLETED", "booking", booking.id, booking.businessId, {
          status: "COMPLETED",
          via: "driver_job.day_ended",
          dayNumber,
        });
      }

      audit(db, actor, "driver_job.day_ended", "driver_day_log", log.id, booking.businessId, {
        bookingId: booking.id,
        dayNumber,
        elapsedMinutes: log.elapsedMinutes,
      });
      const record = hydrateDriverJob(db, token);
      if (!record) throw new DomainError("ไม่พบลิงก์งานคนขับ");
      return record;
    });
  }

  async submitDriverSuggestion(
    token: string,
    input: { body: string; dayNumber?: number | null },
  ): Promise<DriverRouteSuggestion> {
    return mutate((db) => {
      const { link, booking, actor } = requireActiveDriverJob(db, token);
      const body = input.body?.trim() ?? "";
      if (!body) throw new DomainError("กรุณาระบุข้อเสนอแนะ");
      if (body.length > 2000) throw new DomainError("ข้อความยาวเกินไป");
      const dayNumber =
        input.dayNumber == null || input.dayNumber === undefined
          ? null
          : Number(input.dayNumber);
      if (dayNumber != null) {
        const days = serviceDayCount(booking);
        if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > days) {
          throw new DomainError("หมายเลขวันไม่ถูกต้อง");
        }
      }
      const now = stamp();
      const suggestion: DriverRouteSuggestion = {
        id: newId(),
        businessId: booking.businessId,
        bookingId: booking.id,
        driverJobLinkId: link.id,
        driverId: link.driverId,
        dayNumber,
        body,
        status: "OPEN",
        createdAt: now,
      };
      db.driverRouteSuggestions.push(suggestion);
      audit(db, actor, "driver_job.suggestion", "driver_route_suggestion", suggestion.id, booking.businessId, {
        bookingId: booking.id,
        dayNumber,
      });
      return suggestion;
    });
  }

  async listDriverJobForBooking(
    actor: Actor,
    bookingId: string,
  ): Promise<DriverJobAdminSummary> {
    const db = await readDb();
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) throw new DomainError("ไม่พบคำขอจอง");
    assertBusinessAccess(actor, booking.businessId);
    const link =
      db.driverJobLinks.find(
        (item) => item.bookingId === bookingId && item.status === "ACTIVE",
      ) ?? null;
    const dayLogs = db.driverDayLogs
      .filter((item) => item.bookingId === bookingId)
      .filter((item) => (link ? item.driverJobLinkId === link.id : true))
      .sort((a, b) => a.dayNumber - b.dayNumber);
    return { link, dayLogs };
  }

  async adminOverrideStartDay(
    actor: Actor,
    bookingId: string,
    dayNumber: number,
    reason?: string | null,
  ): Promise<DriverDayWorkLog> {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      const link = db.driverJobLinks.find(
        (item) => item.bookingId === bookingId && item.status === "ACTIVE",
      );
      if (!link) throw new DomainError("ยังไม่มีลิงก์งานคนขับ");
      const days = serviceDayCount(booking);
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > days) {
        throw new DomainError("หมายเลขวันไม่ถูกต้อง");
      }
      let log = db.driverDayLogs.find(
        (item) => item.driverJobLinkId === link.id && item.dayNumber === dayNumber,
      );
      if (log?.startedAt) throw new DomainError("วันนี้เริ่มงานแล้ว");
      const now = stamp();
      const overrideReason = reason?.trim() || "admin override";
      if (!log) {
        log = {
          id: newId(),
          businessId: booking.businessId,
          bookingId: booking.id,
          driverJobLinkId: link.id,
          driverId: link.driverId,
          dayNumber,
          dayDate: dateForDayNumber(booking, dayNumber),
          startedAt: now,
          endedAt: null,
          elapsedMinutes: null,
          startedBy: "ADMIN_OVERRIDE",
          endedBy: null,
          overrideReason,
          createdAt: now,
          updatedAt: now,
        };
        db.driverDayLogs.push(log);
      } else {
        log.startedAt = now;
        log.startedBy = "ADMIN_OVERRIDE";
        log.overrideReason = overrideReason;
        log.updatedAt = now;
      }
      if (
        dayNumber === 1 &&
        booking.status === "CONFIRMED" &&
        canTransition(booking.status, "IN_PROGRESS")
      ) {
        booking.status = "IN_PROGRESS";
        if (!booking.actualStartAt) booking.actualStartAt = now;
        booking.updatedAt = now;
      }
      audit(db, actor, "driver_job.day_started_override", "driver_day_log", log.id, booking.businessId, {
        bookingId,
        dayNumber,
        reason: overrideReason,
      });
      return log;
    });
  }

  async adminOverrideEndDay(
    actor: Actor,
    bookingId: string,
    dayNumber: number,
    reason?: string | null,
  ): Promise<DriverDayWorkLog> {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      const link = db.driverJobLinks.find(
        (item) => item.bookingId === bookingId && item.status === "ACTIVE",
      );
      if (!link) throw new DomainError("ยังไม่มีลิงก์งานคนขับ");
      const log = db.driverDayLogs.find(
        (item) => item.driverJobLinkId === link.id && item.dayNumber === dayNumber,
      );
      if (!log?.startedAt) throw new DomainError("ยังไม่ได้เริ่มวันนี้");
      if (log.endedAt) throw new DomainError("วันนี้จบงานแล้ว");
      const now = stamp();
      const overrideReason = reason?.trim() || "admin override";
      log.endedAt = now;
      log.elapsedMinutes = calcElapsedMinutes(log.startedAt, now);
      log.endedBy = "ADMIN_OVERRIDE";
      log.overrideReason = overrideReason;
      log.updatedAt = now;
      audit(db, actor, "driver_job.day_ended_override", "driver_day_log", log.id, booking.businessId, {
        bookingId,
        dayNumber,
        reason: overrideReason,
      });
      return log;
    });
  }

  async markNotificationRead(
    actor: Actor,
    businessId: string,
    notificationId: string,
  ): Promise<NotificationRead> {
    return mutate((db) => {
      assertBusinessAccess(actor, businessId);
      const id = notificationId?.trim();
      if (!id) throw new DomainError("ไม่พบการแจ้งเตือน");
      const existing = db.notificationReads.find(
        (item) => item.businessId === businessId && item.notificationId === id,
      );
      if (existing) return existing;
      const row: NotificationRead = {
        id: newId(),
        businessId,
        notificationId: id,
        readAt: stamp(),
        userId: actor.kind === "user" ? actor.userId : null,
      };
      db.notificationReads.push(row);
      return row;
    });
  }

  async markAllNotificationsRead(
    actor: Actor,
    businessId: string,
    notificationIds: string[],
  ): Promise<NotificationRead[]> {
    return mutate((db) => {
      assertBusinessAccess(actor, businessId);
      const now = stamp();
      const userId = actor.kind === "user" ? actor.userId : null;
      const results: NotificationRead[] = [];
      for (const rawId of notificationIds) {
        const id = rawId?.trim();
        if (!id) continue;
        const existing = db.notificationReads.find(
          (item) => item.businessId === businessId && item.notificationId === id,
        );
        if (existing) {
          results.push(existing);
          continue;
        }
        const row: NotificationRead = {
          id: newId(),
          businessId,
          notificationId: id,
          readAt: now,
          userId,
        };
        db.notificationReads.push(row);
        results.push(row);
      }
      return results;
    });
  }

  async listNotificationReads(actor: Actor, businessId: string): Promise<NotificationRead[]> {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.notificationReads
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.readAt.localeCompare(a.readAt));
  }

  async listDriverDayLogs(actor: Actor, businessId: string): Promise<DriverDayWorkLog[]> {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.driverDayLogs
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listDriverJobLinks(actor: Actor, businessId: string): Promise<DriverJobLink[]> {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.driverJobLinks
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listDriverRouteSuggestions(
    actor: Actor,
    businessId: string,
  ): Promise<DriverRouteSuggestion[]> {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.driverRouteSuggestions
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listBusinesses(actor: Actor) {
    const db = await readDb();
    if (isSuper(actor)) return db.businesses;
    if (actor.kind !== "user") throw new TenantIsolationError();
    return db.businesses.filter((item) => actor.businessIds.includes(item.id));
  }

  async authenticate(email: string, password: string) {
    const db = await readDb();
    const profile = db.profiles.find(
      (item) =>
        item.email.toLowerCase() === email.toLowerCase() &&
        item.passwordHash === password &&
        item.active,
    );
    if (!profile) return null;
    const links = db.businessUsers.filter((item) => item.userId === profile.id && item.active);
    const businessIds = links.map((item) => item.businessId);
    const now = stamp();
    for (const link of links) {
      link.lastLoginAt = now;
    }
    return { profile, businessIds };
  }

  async trackEvent(
    event: Omit<AnalyticsEvent, "id" | "createdAt"> & { id?: string },
  ) {
    await mutate((db) => {
      db.analytics.push({
        id: event.id ?? newId(),
        businessId: event.businessId,
        sessionId: event.sessionId,
        customerId: event.customerId,
        bookingId: event.bookingId,
        eventName: event.eventName,
        eventData: event.eventData,
        source: event.source,
        referrer: event.referrer,
        createdAt: stamp(),
      });
    });
  }

  async listAuditLogs(actor: Actor, businessId: string) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.auditLogs
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listPaymentAccounts(actor: Actor, businessId: string, opts?: { includeInactive?: boolean }) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return accountsOf(db, businessId)
      .filter((item) => opts?.includeInactive || item.isActive)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.displayName.localeCompare(b.displayName));
  }

  async upsertPaymentAccount(actor: Actor, businessId: string, input: PaymentAccountInput) {
    return mutate((db) => {
      assertBusinessAccess(actor, businessId);
      const now = stamp();
      if (input.id) {
        const account = accountById(db, businessId, input.id);
        if (!account) throw new TenantIsolationError("ไม่พบบัญชีของร้านนี้");
        Object.assign(account, {
          displayName: input.displayName.trim(),
          accountType: input.accountType,
          bankCode: input.bankCode?.trim() || null,
          bankName: input.bankName?.trim() || null,
          accountHolderName: input.accountHolderName?.trim() || null,
          accountNumber: input.accountNumber?.trim() || null,
          promptPayId: input.promptPayId?.trim() || null,
          qrImagePath: input.qrImagePath === undefined ? account.qrImagePath : input.qrImagePath,
          qrDisplayEnabled: input.qrDisplayEnabled ?? account.qrDisplayEnabled,
          isActive: input.isActive ?? account.isActive,
          updatedAt: now,
        });
        if (input.isDefault) {
          for (const item of accountsOf(db, businessId)) item.isDefault = item.id === account.id;
        }
        audit(db, actor, "payment_account.upsert", "payment_account", account.id, businessId, {
          displayName: account.displayName,
        });
        return account;
      }
      const account: PaymentAccount = {
        id: newId(),
        businessId,
        displayName: input.displayName.trim(),
        accountType: input.accountType,
        bankCode: input.bankCode?.trim() || null,
        bankName: input.bankName?.trim() || null,
        accountHolderName: input.accountHolderName?.trim() || null,
        accountNumber: input.accountNumber?.trim() || null,
        promptPayId: input.promptPayId?.trim() || null,
        qrImagePath: input.qrImagePath ?? null,
        qrDisplayEnabled: input.qrDisplayEnabled ?? Boolean(input.qrImagePath),
        isDefault: Boolean(input.isDefault) || accountsOf(db, businessId).every((item) => !item.isActive),
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
      if (!account.displayName) throw new DomainError("ใส่ชื่อบัญชีในระบบ");
      if (account.isDefault) {
        for (const item of accountsOf(db, businessId)) item.isDefault = false;
        account.isDefault = true;
      }
      db.paymentAccounts.push(account);
      audit(db, actor, "payment_account.create", "payment_account", account.id, businessId, {
        displayName: account.displayName,
      });
      return account;
    });
  }

  async setDefaultPaymentAccount(actor: Actor, accountId: string) {
    return mutate((db) => {
      const account = db.paymentAccounts.find((item) => item.id === accountId);
      if (!account) throw new DomainError("ไม่พบบัญชีรับเงิน");
      assertBusinessAccess(actor, account.businessId);
      if (!account.isActive) throw new DomainError("เปิดใช้งานบัญชีก่อนตั้งเป็นบัญชีหลัก");
      for (const item of accountsOf(db, account.businessId)) {
        item.isDefault = item.id === account.id;
        item.updatedAt = stamp();
      }
      audit(db, actor, "payment_account.default", "payment_account", account.id, account.businessId, {});
      return account;
    });
  }

  async setPaymentAccountActive(actor: Actor, accountId: string, active: boolean) {
    return mutate((db) => {
      const account = db.paymentAccounts.find((item) => item.id === accountId);
      if (!account) throw new DomainError("ไม่พบบัญชีรับเงิน");
      assertBusinessAccess(actor, account.businessId);
      if (!active) {
        account.isActive = false;
        if (account.isDefault) {
          account.isDefault = false;
          const next = accountsOf(db, account.businessId).find((item) => item.isActive);
          if (next) next.isDefault = true;
        }
      } else {
        account.isActive = true;
      }
      account.updatedAt = stamp();
      audit(db, actor, "payment_account.active", "payment_account", account.id, account.businessId, { active });
      return account;
    });
  }

  async setBookingReceivingAccount(actor: Actor, bookingId: string, accountId: string) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      const account = accountById(db, booking.businessId, accountId);
      if (!account || !account.isActive) throw new DomainError("บัญชีรับเงินนี้ใช้ไม่ได้");
      const previous = booking.receivingAccountId;
      booking.receivingAccountId = account.id;
      booking.updatedAt = stamp();
      audit(db, actor, "PAYMENT_ACCOUNT_CHANGED", "booking", booking.id, booking.businessId, {
        bookingId: booking.id,
        oldAccountId: previous,
        newAccountId: account.id,
        snapshot: snapshotAccount(account),
      });
      return booking;
    });
  }

  async listPaymentProofs(
    actor: Actor,
    businessId: string,
    filter?: { bookingId?: string; reviewStatus?: PaymentProofReviewStatus },
  ) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.paymentProofs
      .filter((item) => item.businessId === businessId)
      .filter((item) => !filter?.bookingId || item.bookingId === filter.bookingId)
      .filter((item) => !filter?.reviewStatus || item.reviewStatus === filter.reviewStatus)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  async getPaymentProof(actor: Actor, proofId: string) {
    const db = await readDb();
    const proof = db.paymentProofs.find((item) => item.id === proofId);
    if (!proof) return null;
    try {
      assertBusinessAccess(actor, proof.businessId);
    } catch (error) {
      if (error instanceof TenantIsolationError) return null;
      throw error;
    }
    return proof;
  }

  async writeSlipFile(
    actor: Actor,
    input: { bookingId: string; bytes: Uint8Array; mime: string; originalName?: string | null },
  ) {
    const sniffed = sniffImage(input.bytes);
    const booking = (await readDb()).bookings.find((item) => item.id === input.bookingId);
    if (!booking) throw new DomainError("ไม่พบคำขอจอง");
    assertBookingActor(actor, booking);
    const ext = sniffed.ext;
    const file: SlipFile = {
      id: newId(),
      businessId: booking.businessId,
      bookingId: booking.id,
      mime: sniffed.mime,
      ext,
      originalName: input.originalName ?? null,
      createdAt: stamp(),
    };
    await writePrivateSlip(booking.businessId, file.id, ext, input.bytes);
    return mutate((db) => {
      const current = db.bookings.find((item) => item.id === input.bookingId);
      if (!current) throw new DomainError("ไม่พบคำขอจอง");
      assertBookingActor(actor, current);
      db.slipFiles.push(file);
      return file;
    });
  }

  async readSlipFile(actor: Actor, fileId: string) {
    const db = await readDb();
    const file = db.slipFiles.find((item) => item.id === fileId);
    if (!file) throw new TenantIsolationError("ไม่พบสลิป");
    assertBusinessAccess(actor, file.businessId);
    const bytes = await readPrivateSlip(file.businessId, file.id, file.ext);
    return { file, bytes, mime: file.mime };
  }

  async readSlipFileByToken(token: string, fileId: string) {
    if (!token || token.length < 20) return null;
    const db = await readDb();
    const file = db.slipFiles.find((item) => item.id === fileId);
    if (!file) return null;
    const booking = db.bookings.find((item) => item.id === file.bookingId);
    if (!booking || booking.securePublicToken !== token) return null;
    const bytes = await readPrivateSlip(file.businessId, file.id, file.ext);
    return { file, bytes, mime: file.mime };
  }

  async submitPaymentProof(actor: Actor, input: PaymentProofSubmitInput) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === input.bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBookingActor(actor, booking);
      const slip = db.slipFiles.find(
        (item) => item.id === input.slipFileId && item.bookingId === booking.id && item.businessId === booking.businessId,
      );
      if (!slip) throw new DomainError("ไม่พบไฟล์สลิปของงานนี้");
      try {
        validateProofAllocations(input.claimedAmount, input.allocations);
      } catch (error) {
        throw new DomainError(error instanceof Error ? error.message : "ยอดแบ่งไม่ถูกต้อง");
      }
      const account =
        accountById(db, booking.businessId, input.receivingAccountId ?? booking.receivingAccountId) ??
        accountForBooking(booking.receivingAccountId, accountsOf(db, booking.businessId));
      if (!account) throw new DomainError("ร้านยังไม่ได้ตั้งบัญชีรับเงิน");
      if (!booking.receivingAccountId) booking.receivingAccountId = account.id;
      const now = stamp();
      const proof: PaymentProof = {
        id: newId(),
        businessId: booking.businessId,
        bookingId: booking.id,
        paymentIntent: input.paymentIntent,
        claimedAmount: money(input.claimedAmount),
        receivingAccountId: account.id,
        receivingAccountSnapshot: snapshotAccount(account),
        slipFileId: slip.id,
        submittedAt: now,
        submittedBy: input.submittedBy ?? (actor.kind === "user" ? "STORE_ADMIN" : "CUSTOMER"),
        submittedByUserId: actor.kind === "user" ? actor.userId : null,
        reviewStatus: "PENDING_REVIEW",
        reviewedBy: null,
        reviewedAt: null,
        rejectReason: null,
        adminNote: null,
        allocations: input.allocations.map((item) => ({ kind: item.kind, amount: money(item.amount) })),
        moneyMovementId: null,
        createdAt: now,
        updatedAt: now,
      };
      db.paymentProofs.push(proof);
      audit(db, actor, "PAYMENT_PROOF_SUBMITTED", "payment_proof", proof.id, booking.businessId, {
        bookingId: booking.id,
        paymentProofId: proof.id,
        claimedAmount: proof.claimedAmount,
        allocations: proof.allocations,
        receivingAccountId: account.id,
        slipFileId: slip.id,
      });
      return proof;
    });
  }

  async updatePaymentProofAllocation(
    actor: Actor,
    proofId: string,
    allocations: MoneyMovement["allocations"],
  ) {
    return mutate((db) => {
      const proof = db.paymentProofs.find((item) => item.id === proofId);
      if (!proof) throw new DomainError("ไม่พบสลิป");
      assertBusinessAccess(actor, proof.businessId);
      if (proof.reviewStatus !== "PENDING_REVIEW") {
        throw new DomainError("แก้การแบ่งยอดได้เฉพาะสลิปที่รอตรวจสอบ");
      }
      try {
        validateProofAllocations(proof.claimedAmount, allocations);
      } catch (error) {
        throw new DomainError(error instanceof Error ? error.message : "ยอดแบ่งไม่ถูกต้อง");
      }
      const before = proof.allocations;
      proof.allocations = allocations.map((item) => ({ kind: item.kind, amount: money(item.amount) }));
      proof.updatedAt = stamp();
      audit(db, actor, "PAYMENT_PROOF_ALLOCATION_CHANGED", "payment_proof", proof.id, proof.businessId, {
        bookingId: proof.bookingId,
        paymentProofId: proof.id,
        allocationBefore: before,
        allocationAfter: proof.allocations,
      });
      return proof;
    });
  }

  async approvePaymentProof(
    actor: Actor,
    proofId: string,
    input?: { allocations?: MoneyMovement["allocations"]; adminNote?: string | null },
  ): Promise<ApproveProofResult> {
    return mutate((db) => {
      const proof = db.paymentProofs.find((item) => item.id === proofId);
      if (!proof) throw new DomainError("ไม่พบสลิป");
      assertBusinessAccess(actor, proof.businessId);
      assertStorePermission(db, actor, proof.businessId, "PAYMENT_PROOF_APPROVE");
      if (proof.reviewStatus === "APPROVED") {
        const movement = proof.moneyMovementId
          ? db.moneyMovements.find((item) => item.id === proof.moneyMovementId) ?? null
          : null;
        return { proof, movement, reused: true };
      }
      if (proof.reviewStatus !== "PENDING_REVIEW") {
        throw new DomainError("สลิปนี้ตรวจสอบแล้ว");
      }
      if (proof.moneyMovementId) {
        const movement = db.moneyMovements.find((item) => item.id === proof.moneyMovementId) ?? null;
        proof.reviewStatus = "APPROVED";
        return { proof, movement, reused: true };
      }
      const allocations = input?.allocations ?? proof.allocations;
      try {
        validateProofAllocations(proof.claimedAmount, allocations);
      } catch (error) {
        throw new DomainError(error instanceof Error ? error.message : "ยอดแบ่งไม่ถูกต้อง");
      }
      const booking = db.bookings.find((item) => item.id === proof.bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      const now = stamp();
      proof.allocations = allocations.map((item) => ({ kind: item.kind, amount: money(item.amount) }));
      const movement: MoneyMovement = {
        id: newId(),
        businessId: booking.businessId,
        bookingId: booking.id,
        direction: "IN",
        transferAmount: proof.claimedAmount,
        allocations: proof.allocations,
        method: "โอน",
        reference: proof.id,
        note: input?.adminNote?.trim() || "อนุมัติสลิป",
        occurredAt: now,
        payeeKind: null,
        payeeId: null,
        payeeName: null,
        actorUserId: actor.kind === "user" ? actor.userId : null,
        paymentProofId: proof.id,
        receivingAccountId: proof.receivingAccountId,
        receivingAccountSnapshot: proof.receivingAccountSnapshot,
        sourceAccountId: null,
        sourceAccountSnapshot: null,
        legacyAccountUnknown: !proof.receivingAccountSnapshot,
        createdAt: now,
      };
      db.moneyMovements.push(movement);
      proof.reviewStatus = "APPROVED";
      proof.reviewedBy = actor.kind === "user" ? actor.userId : null;
      proof.reviewedAt = now;
      proof.adminNote = input?.adminNote?.trim() || proof.adminNote;
      proof.moneyMovementId = movement.id;
      proof.updatedAt = now;
      applyMoneySnapshot(booking, db);
      const after = settleBooking(
        booking,
        db.moneyMovements.filter((item) => item.bookingId === booking.id),
      );
      if (
        booking.status === "WAITING_DEPOSIT" &&
        after.depositReceived >= money(booking.depositAmount) &&
        money(booking.depositAmount) > 0 &&
        canTransition(booking.status, "CONFIRMED")
      ) {
        booking.status = "CONFIRMED";
      }
      // Issue DriverJobLink only when deposit/ops confirmed AND driver assigned (idempotent)
      if (
        booking.assignedDriverId &&
        isDriverJobLinkEligible(booking, db.paymentProofs, booking.id)
      ) {
        const existing = db.driverJobLinks.find(
          (item) =>
            item.bookingId === booking.id &&
            item.status === "ACTIVE" &&
            item.driverId === booking.assignedDriverId,
        );
        if (!existing) {
          for (const link of db.driverJobLinks) {
            if (link.bookingId === booking.id && link.status === "ACTIVE") {
              link.status = "REVOKED";
              link.revokedAt = now;
              link.updatedAt = now;
              audit(db, actor, "driver_job.revoked", "driver_job_link", link.id, booking.businessId, {
                bookingId: booking.id,
                driverId: link.driverId,
                reason: "superseded_on_payment_approve",
              });
            }
          }
          const link: DriverJobLink = {
            id: newId(),
            businessId: booking.businessId,
            bookingId: booking.id,
            driverId: booking.assignedDriverId,
            vehicleId: booking.assignedVehicleId,
            secureToken: newSecureToken(),
            status: "ACTIVE",
            issuedAt: now,
            revokedAt: null,
            firstOpenedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          db.driverJobLinks.push(link);
          audit(db, actor, "driver_job.issued", "driver_job_link", link.id, booking.businessId, {
            bookingId: booking.id,
            driverId: link.driverId,
            vehicleId: link.vehicleId,
            trigger: "payment_approved",
          });
        }
      }
      audit(db, actor, "PAYMENT_PROOF_APPROVED", "payment_proof", proof.id, proof.businessId, {
        bookingId: booking.id,
        paymentProofId: proof.id,
        moneyMovementId: movement.id,
        oldStatus: "PENDING_REVIEW",
        newStatus: "APPROVED",
        allocationAfter: proof.allocations,
        receivingAccountId: proof.receivingAccountId,
        transferAmount: movement.transferAmount,
      });
      return { proof, movement, reused: false };
    });
  }

  async rejectPaymentProof(
    actor: Actor,
    proofId: string,
    input: { reason: string; adminNote?: string | null },
  ) {
    return mutate((db) => {
      const proof = db.paymentProofs.find((item) => item.id === proofId);
      if (!proof) throw new DomainError("ไม่พบสลิป");
      assertBusinessAccess(actor, proof.businessId);
      if (proof.reviewStatus === "APPROVED") {
        throw new DomainError("สลิปที่อนุมัติแล้วปฏิเสธไม่ได้");
      }
      if (proof.reviewStatus !== "PENDING_REVIEW") {
        throw new DomainError("สลิปนี้ตรวจสอบแล้ว");
      }
      const now = stamp();
      proof.reviewStatus = "REJECTED";
      proof.reviewedBy = actor.kind === "user" ? actor.userId : null;
      proof.reviewedAt = now;
      proof.rejectReason = input.reason.trim() || "อื่นๆ";
      proof.adminNote = input.adminNote?.trim() || null;
      proof.updatedAt = now;
      audit(db, actor, "PAYMENT_PROOF_REJECTED", "payment_proof", proof.id, proof.businessId, {
        bookingId: proof.bookingId,
        paymentProofId: proof.id,
        oldStatus: "PENDING_REVIEW",
        newStatus: "REJECTED",
        rejectReason: proof.rejectReason,
        note: proof.adminNote,
        allocations: proof.allocations,
        claimedAmount: proof.claimedAmount,
      });
      return proof;
    });
  }

  async upsertVehicle(actor: Actor, businessId: string, input: VehicleInput) {
    return mutate((db) => {
      assertBusinessAccess(actor, businessId);
      const now = stamp();
      if (input.id) {
        const vehicle = db.vehicles.find(
          (item) => item.id === input.id && item.businessId === businessId,
        );
        if (!vehicle) throw new TenantIsolationError("ไม่พบรถในร้านนี้");
        if (input.active !== false && vehicle.active === false) {
          assertPlanResourceHeadroom(db, businessId, "vehicles");
        }
        const imageUrls = input.imageUrls.slice(0, 8);
        const cover =
          input.coverImageUrl && imageUrls.includes(input.coverImageUrl)
            ? input.coverImageUrl
            : imageUrls[0] ?? null;
        Object.assign(vehicle, {
          ownershipType: input.ownershipType,
          vehicleType: input.vehicleType,
          brand: input.brand,
          model: input.model,
          year: input.year,
          color: input.color,
          plateNumber: input.plateNumber,
          seats: input.seats,
          luggageCapacity: input.luggageCapacity,
          description: input.description,
          amenities: input.amenities,
          basePrice: input.basePrice,
          pricingUnit: input.pricingUnit,
          imageUrls,
          coverImageUrl: cover,
          status: input.status,
          active: input.active,
          updatedAt: now,
        });
        audit(db, actor, "vehicle.upsert", "vehicle", vehicle.id, businessId, {
          model: vehicle.model,
        });
        return vehicle;
      }
      if (input.active !== false) assertPlanResourceHeadroom(db, businessId, "vehicles");
      const imageUrls = input.imageUrls.slice(0, 8);
      const cover =
        input.coverImageUrl && imageUrls.includes(input.coverImageUrl)
          ? input.coverImageUrl
          : imageUrls[0] ?? null;
      const vehicle: Vehicle = {
        id: newId(),
        businessId,
        ownershipType: input.ownershipType,
        vehicleType: input.vehicleType,
        brand: input.brand,
        model: input.model,
        year: input.year,
        color: input.color,
        plateNumber: input.plateNumber,
        seats: input.seats,
        luggageCapacity: input.luggageCapacity,
        description: input.description,
        amenities: input.amenities,
        basePrice: input.basePrice,
        pricingUnit: input.pricingUnit,
        imageUrls,
        coverImageUrl: cover,
        status: input.status,
        active: input.active,
        isSeed: false,
        createdAt: now,
        updatedAt: now,
      };
      db.vehicles.push(vehicle);
      audit(db, actor, "vehicle.create", "vehicle", vehicle.id, businessId, {
        model: vehicle.model,
      });
      return vehicle;
    });
  }

  async setVehicleActive(actor: Actor, vehicleId: string, active: boolean) {
    return mutate((db) => {
      const vehicle = db.vehicles.find((item) => item.id === vehicleId);
      if (!vehicle) throw new DomainError("ไม่พบรถ");
      assertBusinessAccess(actor, vehicle.businessId);
      if (active && vehicle.active === false) {
        assertPlanResourceHeadroom(db, vehicle.businessId, "vehicles");
      }
      vehicle.active = active;
      vehicle.status = active ? "ACTIVE" : "INACTIVE";
      vehicle.updatedAt = stamp();
      audit(db, actor, "vehicle.active", "vehicle", vehicle.id, vehicle.businessId, {
        active,
      });
      return vehicle;
    });
  }

  async upsertDriver(actor: Actor, businessId: string, input: DriverInput) {
    return mutate((db) => {
      assertBusinessAccess(actor, businessId);
      const now = stamp();
      if (input.id) {
        const driver = db.drivers.find(
          (item) => item.id === input.id && item.businessId === businessId,
        );
        if (!driver) throw new TenantIsolationError("ไม่พบคนขับในร้านนี้");
        if (input.active !== false && driver.active === false) {
          assertPlanResourceHeadroom(db, businessId, "drivers");
        }
        Object.assign(driver, {
          ...input,
          id: driver.id,
          businessId,
          updatedAt: now,
        });
        audit(db, actor, "driver.upsert", "driver", driver.id, businessId, {
          name: driver.name,
        });
        return driver;
      }
      if (input.active !== false) assertPlanResourceHeadroom(db, businessId, "drivers");
      const driver: Driver = {
        id: newId(),
        businessId,
        driverType: input.driverType,
        name: input.name,
        nickname: input.nickname,
        phone: input.phone,
        lineId: input.lineId,
        photoUrl: input.photoUrl,
        licenseNumber: input.licenseNumber,
        status: input.status,
        active: input.active,
        isSeed: false,
        createdAt: now,
        updatedAt: now,
      };
      db.drivers.push(driver);
      audit(db, actor, "driver.create", "driver", driver.id, businessId, {
        name: driver.name,
      });
      return driver;
    });
  }

  async setDriverActive(actor: Actor, driverId: string, active: boolean) {
    return mutate((db) => {
      const driver = db.drivers.find((item) => item.id === driverId);
      if (!driver) throw new DomainError("ไม่พบคนขับ");
      assertBusinessAccess(actor, driver.businessId);
      if (active && driver.active === false) {
        assertPlanResourceHeadroom(db, driver.businessId, "drivers");
      }
      driver.active = active;
      driver.status = active ? "ACTIVE" : "INACTIVE";
      driver.updatedAt = stamp();
      audit(db, actor, "driver.active", "driver", driver.id, driver.businessId, {
        active,
      });
      return driver;
    });
  }

  async listCustomers(actor: Actor, businessId: string) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.customers
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getCustomer(actor: Actor, customerId: string) {
    const db = await readDb();
    const customer = db.customers.find((item) => item.id === customerId);
    if (!customer) return null;
    try {
      assertBusinessAccess(actor, customer.businessId);
    } catch (error) {
      if (error instanceof TenantIsolationError) return null;
      throw error;
    }
    return customer;
  }

  async listPlaces(actor: Actor, businessId: string) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    const business = db.businesses.find((item) => item.id === businessId);
    return db.places.filter(
      (item) =>
        item.businessId === businessId ||
        (item.businessId === null && item.provinceId === business?.provinceId),
    );
  }

  async updateBusinessProfile(
    actor: Actor,
    businessId: string,
    patch: Partial<
      Pick<
        Business,
        | "name"
        | "shortName"
        | "logoUrl"
        | "logoMarkUrl"
        | "faviconUrl"
        | "coverUrl"
        | "bookingHeroImageUrl"
        | "bookingMobileHeroImageUrl"
        | "bookingTagline"
        | "bookingLayoutPreset"
        | "bookingThemePreset"
        | "description"
        | "phone"
        | "lineUrl"
        | "facebookUrl"
        | "instagramUrl"
        | "websiteUrl"
        | "email"
        | "address"
        | "primaryColor"
        | "secondaryColor"
        | "accentColor"
        | "textColor"
        | "backgroundColor"
        | "customerSupportText"
        | "poweredByKubHaiEnabled"
      >
    >,
  ) {
    return mutate((db) => {
      assertBusinessAccess(actor, businessId);
      const brandTouched = [
        "logoUrl",
        "logoMarkUrl",
        "faviconUrl",
        "coverUrl",
        "bookingHeroImageUrl",
        "bookingMobileHeroImageUrl",
        "bookingTagline",
        "bookingLayoutPreset",
        "bookingThemePreset",
        "primaryColor",
        "secondaryColor",
        "accentColor",
        "textColor",
        "backgroundColor",
        "poweredByKubHaiEnabled",
        "shortName",
        "name",
      ].some((key) => key in patch);
      if (brandTouched) {
        assertStorePermission(db, actor, businessId, "BRANDING_MANAGE");
      } else {
        assertStorePermission(db, actor, businessId, "STORE_SETTINGS_MANAGE");
      }
      const business = db.businesses.find((item) => item.id === businessId);
      if (!business) throw new DomainError("ไม่พบร้าน");

      const next: typeof patch = { ...patch };

      for (const [field, capability] of Object.entries(BOOKING_APPEARANCE_FIELD_CAPS)) {
        if (!(field in next)) continue;
        if (!hasBookingCapability(business.subscriptionPlan, capability)) {
          throw new DomainError(PLAN_UNLOCK_HINT[capability] || "แพ็กเกจปัจจุบันยังไม่รองรับ");
        }
      }

      if ("bookingHeroImageUrl" in next) {
        next.bookingHeroImageUrl = sanitizeBookingMediaUrl(next.bookingHeroImageUrl ?? null);
      }
      if ("bookingMobileHeroImageUrl" in next) {
        next.bookingMobileHeroImageUrl = sanitizeBookingMediaUrl(next.bookingMobileHeroImageUrl ?? null);
      }
      if ("bookingTagline" in next) {
        next.bookingTagline = sanitizeBookingTagline(next.bookingTagline ?? null);
      }
      if ("bookingLayoutPreset" in next) {
        next.bookingLayoutPreset = sanitizeLayoutPreset(next.bookingLayoutPreset ?? null);
      }
      if ("bookingThemePreset" in next) {
        next.bookingThemePreset = sanitizeLayoutPreset(next.bookingThemePreset ?? null);
      }

      Object.assign(business, next, { updatedAt: stamp() });
      audit(db, actor, "business.update", "business", businessId, businessId, next);
      return business;
    });
  }

  async updateSettings(
    actor: Actor,
    businessId: string,
    patch: Partial<Pick<BusinessSettings, "faq" | "tips" | "bookingNotes" | "defaultDepositPercent" | "ops">>,
  ) {
    return mutate((db) => {
      assertBusinessAccess(actor, businessId);
      let settings = db.settings.find((item) => item.businessId === businessId);
      if (!settings) {
        settings = {
          id: newId(),
          businessId,
          faq: [],
          tips: [],
          bookingNotes: null,
          defaultDepositPercent: 30,
          allowPartnerVehicles: true,
          ops: null,
        };
        db.settings.push(settings);
      }
      Object.assign(settings, patch);
      audit(db, actor, "settings.update", "business_settings", settings.id, businessId, {});
      return settings;
    });
  }

  async updateBookingTrip(actor: Actor, bookingId: string, patch: TripPatch) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      const { locationChangeReason, ...rest } = patch;
      const locationTouched =
        rest.pickupLocation != null ||
        rest.dropoffLocation !== undefined ||
        rest.pickupLat !== undefined ||
        rest.dropoffLat !== undefined;
      if (locationTouched) {
        const hasPickupCheckIn = db.tripCheckIns.some(
          (item) => item.bookingId === booking.id && item.kind === "PICKUP",
        );
        if (hasPickupCheckIn && !locationChangeReason?.trim()) {
          throw new DomainError("หลังเช็กอินจุดรับแล้ว ต้องระบุเหตุผลเมื่อเปลี่ยนจุดรับ/ส่ง");
        }
      }
      const before = {
        pickupLocation: booking.pickupLocation,
        pickupLat: booking.pickupLat,
        pickupLng: booking.pickupLng,
        dropoffLocation: booking.dropoffLocation,
        dropoffLat: booking.dropoffLat,
        dropoffLng: booking.dropoffLng,
      };
      Object.assign(booking, rest, { updatedAt: stamp() });
      audit(db, actor, "booking.trip_update", "booking", booking.id, booking.businessId, {
        ...rest,
        locationChangeReason: locationChangeReason ?? null,
        previous: locationTouched ? before : undefined,
      });
      return booking;
    });
  }

  async addBookingNote(
    actor: Actor,
    bookingId: string,
    body: string,
    options?: { audience?: "INTERNAL" | "CUSTOMER"; title?: string | null },
  ) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      const note: BookingNote = {
        id: newId(),
        bookingId,
        businessId: booking.businessId,
        authorUserId: actor.kind === "user" ? actor.userId : null,
        body: body.trim(),
        audience: options?.audience ?? "INTERNAL",
        title: options?.title?.trim() || null,
        createdAt: stamp(),
      };
      if (!note.body) throw new DomainError("กรอกโน้ตก่อนบันทึก");
      db.bookingNotes.push(note);
      audit(db, actor, "booking.note", "booking", bookingId, booking.businessId, {
        audience: note.audience,
      });
      return note;
    });
  }

  async listMoneyMovements(actor: Actor, businessId: string, bookingId?: string) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.moneyMovements
      .filter((item) => item.businessId === businessId && (!bookingId || item.bookingId === bookingId))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async updateBookingFinancePlan(actor: Actor, bookingId: string, patch: BookingFinancePlan) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      if (booking.acceptedQuotationId) {
        if (patch.quotedTotal !== undefined && patch.quotedTotal !== booking.quotedTotal) {
          throw new DomainError("มีการยืนยันใบเสนอราคาแล้ว แก้ยอดบริการต้องสร้างฉบับแก้ไข");
        }
        if (patch.depositAmount !== undefined && patch.depositAmount !== booking.depositAmount) {
          throw new DomainError("มีการยืนยันใบเสนอราคาแล้ว แก้ยอดบริการต้องสร้างฉบับแก้ไข");
        }
      }
      if (patch.quotedTotal !== undefined) booking.quotedTotal = patch.quotedTotal;
      if (patch.depositAmount !== undefined) booking.depositAmount = patch.depositAmount;
      if (patch.driverFeeAmount !== undefined) booking.driverFeeAmount = patch.driverFeeAmount;
      const snapshot = settleBooking(
        booking,
        db.moneyMovements.filter((item) => item.bookingId === booking.id),
      );
      booking.balanceAmount = snapshot.remainingBalance;
      booking.updatedAt = stamp();
      audit(db, actor, "booking.finance_plan", "booking", booking.id, booking.businessId, patch);
      return booking;
    });
  }

  async recordMoneyMovement(actor: Actor, bookingId: string, input: MoneyMovementInput) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      try {
        assertAllocationMatch(input.transferAmount, input.allocations);
      } catch (error) {
        throw new DomainError(error instanceof Error ? error.message : "ยอดแบ่งไม่ถูกต้อง");
      }
      const incoming = ["DEPOSIT", "SERVICE_BALANCE", "TIP_RECEIVED"];
      const outgoing = ["DRIVER_PAYOUT", "TIP_PAYOUT", "PARTNER_PAYOUT"];
      for (const line of input.allocations) {
        if (input.direction === "IN" && !incoming.includes(line.kind)) {
          throw new DomainError("ประเภทการแบ่งเงินรับไม่ถูกต้อง");
        }
        if (input.direction === "OUT" && !outgoing.includes(line.kind)) {
          throw new DomainError("ประเภทการแบ่งเงินจ่ายไม่ถูกต้อง");
        }
      }
      if (input.direction === "OUT" && !input.payeeKind) {
        throw new DomainError("เลือกรูปแบบผู้รับก่อนบันทึกการโอน");
      }
      const receiving = accountById(
        db,
        booking.businessId,
        input.receivingAccountId ?? (input.direction === "IN" ? booking.receivingAccountId : null),
      );
      const source = accountById(db, booking.businessId, input.sourceAccountId);
      const movement: MoneyMovement = {
        id: newId(),
        businessId: booking.businessId,
        bookingId: booking.id,
        direction: input.direction,
        transferAmount: money(input.transferAmount),
        allocations: input.allocations.map((item) => ({ kind: item.kind, amount: money(item.amount) })),
        method: input.method?.trim() || null,
        reference: input.reference?.trim() || null,
        note: input.note?.trim() || null,
        occurredAt: input.occurredAt || stamp(),
        payeeKind: input.payeeKind ?? null,
        payeeId: input.payeeId ?? null,
        payeeName: input.payeeName?.trim() || null,
        actorUserId: actor.kind === "user" ? actor.userId : null,
        paymentProofId: input.paymentProofId ?? null,
        receivingAccountId: receiving?.id ?? null,
        receivingAccountSnapshot: receiving ? snapshotAccount(receiving) : null,
        sourceAccountId: source?.id ?? null,
        sourceAccountSnapshot: source ? snapshotAccount(source) : null,
        legacyAccountUnknown: !receiving && !source,
        createdAt: stamp(),
      };
      db.moneyMovements.push(movement);
      applyMoneySnapshot(booking, db);
      audit(
        db,
        actor,
        input.direction === "OUT" ? "PAYOUT_RECORDED" : "booking.money",
        "money_movement",
        movement.id,
        booking.businessId,
        {
          bookingId: booking.id,
          direction: movement.direction,
          transferAmount: movement.transferAmount,
          allocations: movement.allocations,
          paymentProofId: movement.paymentProofId,
          receivingAccountId: movement.receivingAccountId,
          sourceAccountId: movement.sourceAccountId,
        },
      );
      return movement;
    });
  }

  async upsertItineraryItem(
    actor: Actor,
    bookingId: string,
    input: Partial<BookingItineraryItem> & { title: string },
  ) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      if (input.id) {
        const item = db.itinerary.find(
          (row) => row.id === input.id && row.businessId === booking.businessId,
        );
        if (!item) throw new TenantIsolationError();
        Object.assign(item, {
          title: input.title,
          location: input.location ?? item.location,
          dayNumber: input.dayNumber ?? item.dayNumber,
          estimatedMinutes: input.estimatedMinutes ?? item.estimatedMinutes,
          note: input.note ?? item.note,
          placeId: input.placeId ?? item.placeId,
          sortOrder: input.sortOrder ?? item.sortOrder,
        });
        audit(db, actor, "itinerary.update", "itinerary", item.id, booking.businessId, {});
        return item;
      }
      const item: BookingItineraryItem = {
        id: newId(),
        bookingId,
        businessId: booking.businessId,
        placeId: input.placeId ?? null,
        title: input.title,
        location: input.location ?? null,
        dayNumber: input.dayNumber ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        note: input.note ?? null,
        sortOrder: input.sortOrder ?? db.itinerary.filter((row) => row.bookingId === bookingId).length,
        kind: input.kind ?? "STOP",
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        address: input.address ?? input.location ?? null,
        source: input.source ?? null,
      };
      db.itinerary.push(item);
      audit(db, actor, "itinerary.create", "itinerary", item.id, booking.businessId, {});
      return item;
    });
  }

  async deleteItineraryItem(actor: Actor, itemId: string) {
    await mutate((db) => {
      const item = db.itinerary.find((row) => row.id === itemId);
      if (!item) throw new DomainError("ไม่พบรายการทริป");
      assertBusinessAccess(actor, item.businessId);
      db.itinerary = db.itinerary.filter((row) => row.id !== itemId);
      audit(db, actor, "itinerary.delete", "itinerary", itemId, item.businessId, {});
    });
  }

  async previewAssignment(
    actor: Actor,
    bookingId: string,
    input: { vehicleId?: string | null; driverId?: string | null },
  ): Promise<AssignmentPreview> {
    const db = await readDb();
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) throw new DomainError("ไม่พบคำขอจอง");
    assertBusinessAccess(actor, booking.businessId);
    const tenantBookings = db.bookings.filter((item) => item.businessId === booking.businessId);
    const hard = findAssignmentConflict({
      bookings: tenantBookings,
      vehicleId: input.vehicleId,
      driverId: input.driverId,
      range: booking,
      ignoreBookingId: booking.id,
    });
    const warn = findAssignmentWarning({
      bookings: tenantBookings,
      vehicleId: input.vehicleId,
      driverId: input.driverId,
      range: booking,
      ignoreBookingId: booking.id,
    });
    return {
      hardVehicle: hard.vehicle,
      hardDriver: hard.driver,
      warnVehicle: warn.vehicle,
      warnDriver: warn.driver,
    };
  }

  async upsertPlace(actor: Actor, businessId: string, input: PlaceInput) {
    return mutate((db) => {
      assertBusinessAccess(actor, businessId);
      const business = db.businesses.find((item) => item.id === businessId);
      if (!business) throw new DomainError("ไม่พบร้าน");
      const cleaned = sanitizePlaceImages({
        coverImageUrl: input.coverImageUrl ?? input.imageUrls[0] ?? null,
        imageUrls: input.imageUrls,
      });
      const cover =
        cleaned.coverImageUrl && cleaned.imageUrls.includes(cleaned.coverImageUrl)
          ? cleaned.coverImageUrl
          : cleaned.imageUrls[0] ?? null;
      if (input.id) {
        const place = db.places.find((item) => item.id === input.id && item.businessId === businessId);
        if (!place) throw new TenantIsolationError("แก้ได้เฉพาะสถานที่ของร้าน");
        Object.assign(place, {
          category: input.category,
          name: input.name,
          shortDescription:
            input.shortDescription !== undefined ? input.shortDescription : place.shortDescription,
          description: input.description,
          address: input.address,
          area: input.area ?? place.area,
          latitude: input.latitude !== undefined ? input.latitude : place.latitude,
          longitude: input.longitude !== undefined ? input.longitude : place.longitude,
          googlePlaceId:
            input.googlePlaceId !== undefined ? input.googlePlaceId : place.googlePlaceId ?? null,
          imageUrls: cleaned.imageUrls,
          coverImageUrl: cover,
          localRecommended: input.localRecommended,
          estimatedDurationMinutes: input.estimatedDurationMinutes,
          status: input.status,
          updatedAt: stamp(),
        });
        audit(db, actor, "place.upsert", "place", place.id, businessId, { name: place.name });
        return place;
      }
      const place: Place = normalizePlace({
        id: newId(),
        businessId,
        provinceId: business.provinceId ?? db.provinces[0].id,
        category: input.category,
        placeKind: "PLACE",
        name: input.name,
        slug: `${input.name.toLowerCase().replace(/[^a-z0-9ก-๙]+/gi, "-")}-${newId().slice(0, 8)}`,
        shortDescription: input.shortDescription ?? null,
        description: input.description,
        imageUrls: cleaned.imageUrls,
        coverImageUrl: cover,
        address: input.address,
        area: input.area ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        googlePlaceId: input.googlePlaceId ?? null,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        localRecommended: input.localRecommended,
        status: input.status,
        isSeed: false,
        createdAt: stamp(),
        updatedAt: stamp(),
      });
      db.places.push(place);
      audit(db, actor, "place.create", "place", place.id, businessId, { name: place.name });
      return place;
    });
  }

  async setPlaceActive(actor: Actor, placeId: string, active: boolean) {
    return mutate((db) => {
      const place = db.places.find((item) => item.id === placeId);
      if (!place || !place.businessId) throw new TenantIsolationError("แก้ได้เฉพาะสถานที่ของร้าน");
      assertBusinessAccess(actor, place.businessId);
      place.status = active ? "ACTIVE" : "HIDDEN";
      audit(db, actor, "place.active", "place", place.id, place.businessId, { active });
      return place;
    });
  }

  /** Soft-archive: always HIDDEN. Never hard-delete when itinerary history references the place. */
  async archivePlace(actor: Actor, placeId: string) {
    return mutate((db) => {
      const place = db.places.find((item) => item.id === placeId);
      if (!place || !place.businessId) throw new TenantIsolationError("แก้ได้เฉพาะสถานที่ของร้าน");
      assertBusinessAccess(actor, place.businessId);
      const referenced =
        db.bookings.some(
          (booking) =>
            booking.businessId === place.businessId &&
            (booking.pickupPlaceId === placeId || booking.dropoffPlaceId === placeId),
        ) || db.itinerary.some((row) => row.placeId === placeId);
      place.status = "HIDDEN";
      place.updatedAt = stamp();
      audit(db, actor, "place.archive", "place", place.id, place.businessId, {
        soft: true,
        referenced: Boolean(referenced),
      });
      return place;
    });
  }

  async listTripPackages(actor: Actor, businessId: string, filter?: TripPackageListFilter) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    let rows = db.tripPackages.filter((item) => item.businessId === businessId);
    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      rows = rows.filter((item) => statuses.includes(item.status));
    } else if (!filter?.includeArchived) {
      rows = rows.filter((item) => item.status !== "ARCHIVED");
    }
    if (typeof filter?.featured === "boolean") {
      rows = rows.filter((item) => item.featured === filter.featured);
    }
    return sortFeaturedPackages(rows);
  }

  async listPublicTripPackages(businessId: string) {
    const db = await readDb();
    const rows = db.tripPackages.filter(
      (item) => item.businessId === businessId && isCustomerVisiblePackage(item),
    );
    return sortFeaturedPackages(rows);
  }

  async getTripPackage(actor: Actor, id: string) {
    const db = await readDb();
    const pkg = db.tripPackages.find((item) => item.id === id);
    if (!pkg) return null;
    try {
      assertBusinessAccess(actor, pkg.businessId);
    } catch (error) {
      if (error instanceof TenantIsolationError) return null;
      throw error;
    }
    return pkg;
  }

  async getPublicTripPackage(businessId: string, id: string) {
    const db = await readDb();
    const pkg = db.tripPackages.find(
      (item) => item.id === id && item.businessId === businessId,
    );
    if (!pkg || !isCustomerVisiblePackage(pkg)) return null;
    return pkg;
  }

  async createTripPackage(actor: Actor, businessId: string, input: TripPackageWriteInput) {
    return mutate((db) => {
      assertBusinessAccess(actor, businessId);
      assertTripPackagesEntitlement(db, businessId);
      const now = stamp();
      const normalized = normalizeTripPackageWrite(input);
      const pkg: TripPackage = {
        id: newId(),
        businessId,
        status: "DRAFT",
        featured: Boolean(input.featured),
        displayOrder: typeof input.displayOrder === "number" ? input.displayOrder : 100,
        ...normalized,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      };
      db.tripPackages.push(pkg);
      audit(db, actor, "trip_package.create", "trip_package", pkg.id, businessId, {
        title: pkg.title.th,
      });
      return pkg;
    });
  }

  async updateTripPackage(actor: Actor, id: string, input: TripPackageUpdateInput) {
    return mutate((db) => {
      const pkg = requireTripPackage(db, id);
      assertBusinessAccess(actor, pkg.businessId);
      assertTripPackagesEntitlement(db, pkg.businessId);
      const next = applyTripPackagePatch(pkg, input);
      Object.assign(pkg, next, { updatedAt: stamp() });
      audit(db, actor, "trip_package.update", "trip_package", pkg.id, pkg.businessId, {
        fields: Object.keys(input),
      });
      return pkg;
    });
  }

  async setTripPackageStatus(actor: Actor, id: string, status: TripPackageStatus) {
    return mutate((db) => {
      const pkg = requireTripPackage(db, id);
      assertBusinessAccess(actor, pkg.businessId);
      assertTripPackagesEntitlement(db, pkg.businessId);
      applyTripPackageStatus(pkg, status);
      audit(db, actor, "trip_package.status", "trip_package", pkg.id, pkg.businessId, {
        status,
      });
      return pkg;
    });
  }

  async publishTripPackage(actor: Actor, id: string) {
    return this.setTripPackageStatus(actor, id, "PUBLISHED");
  }

  async unpublishTripPackage(actor: Actor, id: string) {
    return this.setTripPackageStatus(actor, id, "UNPUBLISHED");
  }

  async archiveTripPackage(actor: Actor, id: string) {
    return this.setTripPackageStatus(actor, id, "ARCHIVED");
  }

  async loadTenantBoard(actor: Actor, businessId: string): Promise<TenantBoard> {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    const business = db.businesses.find((item) => item.id === businessId);
    if (!business) throw new DomainError("ไม่พบร้าน");
    return {
      business,
      settings: db.settings.find((item) => item.businessId === businessId) ?? null,
      bookings: db.bookings
        .filter((item) => item.businessId === businessId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      vehicles: db.vehicles.filter((item) => item.businessId === businessId),
      drivers: db.drivers.filter((item) => item.businessId === businessId),
      customers: db.customers.filter((item) => item.businessId === businessId),
      places: db.places.filter(
        (item) =>
          item.businessId === businessId ||
          (item.businessId === null && item.provinceId === business.provinceId),
      ),
      staff: staffOf(db, businessId),
    };
  }

  async searchOps(actor: Actor, businessId: string, query: string) {
    const board = await this.loadTenantBoard(actor, businessId);
    return searchBoard(query, board);
  }

  async listQuotations(actor: Actor, businessId: string, bookingId?: string) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    return db.quotations
      .filter((item) => item.businessId === businessId && (!bookingId || item.bookingId === bookingId))
      .map((item) => hydrateQuotation(db, item))
      .sort((a, b) => a.quotationNumber.localeCompare(b.quotationNumber) || a.version - b.version);
  }

  async getQuotation(actor: Actor, quotationId: string) {
    const db = await readDb();
    const quotation = db.quotations.find((item) => item.id === quotationId);
    if (!quotation) return null;
    if (actor.kind === "booking_token") {
      const booking = db.bookings.find((item) => item.id === quotation.bookingId);
      if (!booking) return null;
      assertBookingActor(actor, booking);
      if (!isCustomerVisible(quotation)) return null;
      return hydrateQuotation(db, quotation);
    }
    assertBusinessAccess(actor, quotation.businessId);
    return hydrateQuotation(db, quotation);
  }

  async createQuotationDraft(actor: Actor, bookingId: string) {
    return mutate((db) => {
      const booking = requireBooking(db, bookingId);
      assertBusinessAccess(actor, booking.businessId);
      const existing = db.quotations.filter((item) => item.bookingId === booking.id);
      const draft = existing.find((item) => item.status === "DRAFT");
      if (draft) return hydrateQuotation(db, draft);
      for (const item of existing) persistExpired(item);
      const current = currentAdminQuotation(existing);
      const currentStatus = current ? effectiveQuotationStatus(current) : null;
      if (
        currentStatus === "SENT" ||
        currentStatus === "CUSTOMER_CHANGE_REQUESTED" ||
        currentStatus === "CUSTOMER_ACCEPTED"
      ) {
        throw new DomainError("ใบเสนอราคานี้ส่งแล้ว กรุณาสร้างฉบับแก้ไข");
      }
      return createDraftFrom(db, actor, booking, current ?? null);
    });
  }

  async updateQuotationDraft(actor: Actor, quotationId: string, input: QuotationDraftInput) {
    return mutate((db) => {
      const quotation = requireQuotation(db, quotationId);
      assertBusinessAccess(actor, quotation.businessId);
      persistExpired(quotation);
      if (quotation.status !== "DRAFT") {
        throw new DomainError("แก้ได้เฉพาะฉบับร่าง");
      }
      const booking = requireBooking(db, quotation.bookingId);
      if (booking.acceptedQuotationId === quotation.id) {
        throw new DomainError("มีการยืนยันใบเสนอราคาแล้ว ต้องสร้างฉบับแก้ไข");
      }
      const before = { totalAmount: quotation.totalAmount, depositRequiredAmount: quotation.depositRequiredAmount };
      applyDraftInput(db, quotation, input);
      quotation.updatedAt = stamp();
      audit(db, actor, "QUOTATION_UPDATED", "quotation", quotation.id, quotation.businessId, {
        bookingId: quotation.bookingId,
        quotationId: quotation.id,
        version: quotation.version,
        before,
        after: { totalAmount: quotation.totalAmount, depositRequiredAmount: quotation.depositRequiredAmount },
      });
      return hydrateQuotation(db, quotation);
    });
  }

  async sendQuotation(actor: Actor, quotationId: string) {
    return mutate((db) => {
      const quotation = requireQuotation(db, quotationId);
      assertBusinessAccess(actor, quotation.businessId);
      if (quotation.status !== "DRAFT") throw new DomainError("ส่งได้เฉพาะฉบับร่าง");
      const booking = requireBooking(db, quotation.bookingId);
      if (!booking.securePublicToken) throw new DomainError("ลิงก์ลูกค้าไม่ถูกต้อง");
      const items = itemsOf(db, quotation.id);
      const totals = safeTotals(items, quotation.discountAmount, quotation.depositType, quotation.depositValue);
      try {
        assertSendable(items, totals);
      } catch (error) {
        throw new DomainError(error instanceof Error ? error.message : "ส่งใบเสนอราคาไม่ได้");
      }
      const now = stamp();
      for (const prior of db.quotations.filter((item) => item.bookingId === booking.id && item.id !== quotation.id)) {
        persistExpired(prior);
        if (
          prior.status === "SENT" ||
          prior.status === "CUSTOMER_CHANGE_REQUESTED" ||
          prior.status === "EXPIRED"
        ) {
          prior.status = "SUPERSEDED";
          prior.updatedAt = now;
          audit(db, actor, "QUOTATION_SUPERSEDED", "quotation", prior.id, prior.businessId, {
            bookingId: booking.id,
            quotationId: prior.id,
            version: prior.version,
            supersededBy: quotation.id,
          });
        }
      }
      quotation.status = "SENT";
      quotation.sentAt = now;
      quotation.updatedAt = now;
      Object.assign(quotation, totals);
      if (canTransition(booking.status, "QUOTATION_SENT")) {
        booking.status = "QUOTATION_SENT";
        booking.updatedAt = now;
      }
      audit(db, actor, "QUOTATION_SENT", "quotation", quotation.id, quotation.businessId, {
        bookingId: booking.id,
        quotationId: quotation.id,
        version: quotation.version,
        totalAmount: quotation.totalAmount,
        depositRequiredAmount: quotation.depositRequiredAmount,
      });
      return hydrateQuotation(db, quotation);
    });
  }

  async createQuotationRevision(actor: Actor, quotationId: string) {
    return mutate((db) => {
      const source = requireQuotation(db, quotationId);
      assertBusinessAccess(actor, source.businessId);
      persistExpired(source);
      const booking = requireBooking(db, source.bookingId);
      const draft = db.quotations.find((item) => item.bookingId === booking.id && item.status === "DRAFT");
      if (draft) return hydrateQuotation(db, draft);
      if (source.status === "DRAFT") return hydrateQuotation(db, source);
      return createDraftFrom(db, actor, booking, source);
    });
  }

  async cancelQuotation(actor: Actor, quotationId: string) {
    return mutate((db) => {
      const quotation = requireQuotation(db, quotationId);
      assertBusinessAccess(actor, quotation.businessId);
      persistExpired(quotation);
      if (quotation.status === "CUSTOMER_ACCEPTED") {
        throw new DomainError("ยกเลิกใบที่ลูกค้ายืนยันแล้วไม่ได้");
      }
      if (quotation.status === "SUPERSEDED" || quotation.status === "CANCELLED") {
        throw new DomainError("ใบเสนอราคานี้ปิดแล้ว");
      }
      quotation.status = "CANCELLED";
      quotation.updatedAt = stamp();
      audit(db, actor, "QUOTATION_CANCELLED", "quotation", quotation.id, quotation.businessId, {
        bookingId: quotation.bookingId,
        quotationId: quotation.id,
        version: quotation.version,
      });
      return hydrateQuotation(db, quotation);
    });
  }

  async acceptQuotation(actor: Actor, quotationId: string) {
    return mutate((db) => {
      const quotation = requireQuotation(db, quotationId);
      const booking = requireBooking(db, quotation.bookingId);
      if (actor.kind === "customer") {
        const account = requireVerifiedCustomerAccount(db, actor.customerAccountId);
        const owns =
          booking.customerAccountId === account.id ||
          phonesMatch(account.phoneNormalized, booking.customerPhoneSnapshot);
        if (!owns) throw new TenantIsolationError("ไม่มีสิทธิ์เข้าถึงการจองนี้");
        if (!booking.customerAccountId) {
          booking.customerAccountId = account.id;
          audit(db, actor, "BOOKING_LINKED_TO_CUSTOMER", "booking", booking.id, booking.businessId, {
            customerAccountId: account.id,
          });
        }
      } else if (actor.kind === "booking_token") {
        assertBookingActor(actor, booking);
      } else {
        throw new TenantIsolationError();
      }
      persistExpired(quotation);
      if (quotation.status === "EXPIRED" || isQuotationExpired(quotation)) {
        quotation.status = "EXPIRED";
        quotation.updatedAt = stamp();
        throw new DomainError("ใบเสนอราคาหมดอายุ");
      }
      if (quotation.status !== "SENT") throw new DomainError("ยืนยันได้เฉพาะใบที่ส่งแล้ว");
      const now = stamp();
      for (const prior of db.quotations.filter((item) => item.bookingId === booking.id && item.id !== quotation.id)) {
        if (prior.status === "CUSTOMER_ACCEPTED") {
          prior.status = "SUPERSEDED";
          prior.updatedAt = now;
          audit(db, actor, "QUOTATION_SUPERSEDED", "quotation", prior.id, prior.businessId, {
            bookingId: booking.id,
            quotationId: prior.id,
            version: prior.version,
            supersededBy: quotation.id,
          });
        }
      }
      quotation.status = "CUSTOMER_ACCEPTED";
      quotation.acceptedAt = now;
      quotation.updatedAt = now;
      applyAcceptedCommercials(booking, quotation);
      booking.updatedAt = now;
      const nextStatus = quotation.depositRequiredAmount > 0 ? "WAITING_DEPOSIT" : "CUSTOMER_CONFIRMED";
      if (canTransition(booking.status, nextStatus)) {
        booking.status = nextStatus;
      }
      audit(db, actor, "QUOTATION_ACCEPTED", "quotation", quotation.id, quotation.businessId, {
        bookingId: booking.id,
        quotationId: quotation.id,
        version: quotation.version,
        totalAmount: quotation.totalAmount,
        depositRequiredAmount: quotation.depositRequiredAmount,
        moneyCreated: false,
      });
      return hydrateQuotation(db, quotation);
    });
  }

  async requestQuotationChange(actor: Actor, quotationId: string, text: string) {
    return mutate((db) => {
      const quotation = requireQuotation(db, quotationId);
      const booking = requireBooking(db, quotation.bookingId);
      assertBookingActor(actor, booking);
      if (actor.kind !== "booking_token") throw new TenantIsolationError();
      persistExpired(quotation);
      if (quotation.status === "EXPIRED" || isQuotationExpired(quotation)) {
        quotation.status = "EXPIRED";
        throw new DomainError("ใบเสนอราคาหมดอายุ");
      }
      if (quotation.status !== "SENT") throw new DomainError("ขอแก้ไขได้เฉพาะใบที่ส่งแล้ว");
      const request = text.trim();
      if (!request) throw new DomainError("บอกสิ่งที่ต้องการแก้ไข");
      const now = stamp();
      quotation.status = "CUSTOMER_CHANGE_REQUESTED";
      quotation.changeRequestText = request;
      quotation.changeRequestedAt = now;
      quotation.updatedAt = now;
      audit(db, actor, "QUOTATION_CHANGE_REQUESTED", "quotation", quotation.id, quotation.businessId, {
        bookingId: booking.id,
        quotationId: quotation.id,
        version: quotation.version,
        request,
      });
      return hydrateQuotation(db, quotation);
    });
  }

  async rejectQuotation(actor: Actor, quotationId: string, reason: string | null) {
    return mutate((db) => {
      const quotation = requireQuotation(db, quotationId);
      const booking = requireBooking(db, quotation.bookingId);
      assertBookingActor(actor, booking);
      if (actor.kind !== "booking_token") throw new TenantIsolationError();
      persistExpired(quotation);
      if (quotation.status === "EXPIRED" || isQuotationExpired(quotation)) {
        quotation.status = "EXPIRED";
        throw new DomainError("ใบเสนอราคาหมดอายุ");
      }
      if (quotation.status !== "SENT" && quotation.status !== "CUSTOMER_CHANGE_REQUESTED") {
        throw new DomainError("ปฏิเสธได้เฉพาะใบที่ส่งแล้ว");
      }
      const now = stamp();
      quotation.status = "CUSTOMER_REJECTED";
      quotation.rejectReason = reason?.trim() || null;
      quotation.rejectedAt = now;
      quotation.updatedAt = now;
      audit(db, actor, "QUOTATION_REJECTED", "quotation", quotation.id, quotation.businessId, {
        bookingId: booking.id,
        quotationId: quotation.id,
        version: quotation.version,
        reason: quotation.rejectReason,
        moneyCreated: false,
      });
      return hydrateQuotation(db, quotation);
    });
  }

  // ─── Customer Auth (platform identity) ───────────────────────────────────

  async getCustomerAccount(customerAccountId: string) {
    const db = await readDb();
    return accountByIdAuth(db, customerAccountId);
  }

  async requestCustomerOtp(input: {
    phone: string;
    purpose: OtpPurpose;
    customerAccountId?: string | null;
  }) {
    return mutate((db) => {
      const phoneNormalized = normalizePhone(input.phone);
      if (phoneNormalized.length < 9) throw new DomainError("เบอร์โทรไม่ถูกต้อง");
      const recent = countRecentOtpRequests(db.otpChallenges, phoneNormalized);
      if (recent >= OTP_MAX_REQUESTS_PER_HOUR) {
        throw new DomainError("ขอรหัสบ่อยเกินไป กรุณาลองใหม่ภายหลัง");
      }
      const now = Date.now();
      const last = [...db.otpChallenges]
        .filter((item) => item.phoneNormalized === phoneNormalized && item.purpose === input.purpose)
        .sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt))[0];
      if (last && Date.parse(last.lastSentAt) + OTP_RESEND_COOLDOWN_MS > now) {
        throw new DomainError("กรุณารอสักครู่ก่อนขอรหัสใหม่");
      }
      // Invalidate previous unused OTPs for same phone+purpose
      for (const item of db.otpChallenges) {
        if (
          item.phoneNormalized === phoneNormalized &&
          item.purpose === input.purpose &&
          !item.consumedAt
        ) {
          item.consumedAt = stamp();
        }
      }
      const code = generateOtpCode();
      const challenge: OtpChallengeRecord = {
        id: newId(),
        phoneNormalized,
        purpose: input.purpose,
        codeHash: hashOtpCode(code),
        attempts: 0,
        maxAttempts: OTP_MAX_ATTEMPTS,
        consumedAt: null,
        expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
        createdAt: stamp(),
        lastSentAt: stamp(),
        customerAccountId: input.customerAccountId ?? null,
      };
      db.otpChallenges.push(challenge);
      audit(db, { kind: "public", sessionId: "otp" }, "CUSTOMER_OTP_REQUESTED", "customer_account", input.customerAccountId ?? null, null, {
        purpose: input.purpose,
        phoneNormalized,
        // never log code
      });
      return {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
        resendAvailableAt: new Date(now + OTP_RESEND_COOLDOWN_MS).toISOString(),
        ...(isDevOtpEnabled() ? { devCode: code } : {}),
      };
    });
  }

  async verifyCustomerOtp(input: { challengeId: string; code: string }) {
    return mutate((db) => {
      const challenge = db.otpChallenges.find((item) => item.id === input.challengeId);
      if (!challenge) return { ok: false as const, reason: "NOT_FOUND" as const };
      if (challenge.consumedAt) return { ok: false as const, reason: "USED" as const };
      if (Date.parse(challenge.expiresAt) < Date.now()) {
        return { ok: false as const, reason: "EXPIRED" as const };
      }
      if (challenge.attempts >= challenge.maxAttempts) {
        return { ok: false as const, reason: "LOCKED" as const };
      }
      challenge.attempts += 1;
      if (!hashMatches(input.code, challenge.codeHash)) {
        return { ok: false as const, reason: "INVALID" as const };
      }
      challenge.consumedAt = stamp();
      return {
        ok: true as const,
        phoneNormalized: challenge.phoneNormalized,
        purpose: challenge.purpose,
        customerAccountId: challenge.customerAccountId,
      };
    });
  }

  async startCustomerSignup(phone: string) {
    const phoneNormalized = normalizePhone(phone);
    const db = await readDb();
    const existing = db.customerAccounts.find(
      (item) => item.phoneNormalized === phoneNormalized && item.phoneVerifiedAt,
    );
    if (existing) throw new DomainError("เบอร์นี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ");
    return this.requestCustomerOtp({ phone, purpose: "SIGNUP" });
  }

  async completeCustomerSignup(input: {
    challengeId: string;
    code: string;
    password: string;
    displayName?: string | null;
  }) {
    const verified = await this.verifyCustomerOtp({ challengeId: input.challengeId, code: input.code });
    if (!verified.ok) throw new DomainError("รหัส OTP ไม่ถูกต้องหรือหมดอายุ");
    return mutate((db) => {
      const phoneNormalized = verified.phoneNormalized;
      const dup = db.customerAccounts.find(
        (item) => item.phoneNormalized === phoneNormalized && item.phoneVerifiedAt,
      );
      if (dup) throw new DomainError("เบอร์นี้มีบัญชีอยู่แล้ว");
      const now = stamp();
      const account: CustomerAccount = {
        id: newId(),
        phone: phoneNormalized,
        phoneNormalized,
        phoneVerifiedAt: now,
        email: null,
        displayName: input.displayName?.trim() || null,
        passwordHash: hashPassword(input.password),
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };
      db.customerAccounts.push(account);
      db.customerIdentities.push({
        id: newId(),
        customerAccountId: account.id,
        provider: "PHONE",
        providerSubjectId: phoneNormalized,
        providerEmail: null,
        linkedAt: now,
      });
      audit(db, { kind: "customer", customerAccountId: account.id }, "CUSTOMER_PHONE_VERIFIED", "customer_account", account.id, null, {
        phoneNormalized,
      });
      audit(db, { kind: "customer", customerAccountId: account.id }, "CUSTOMER_LOGIN", "customer_account", account.id, null, {
        method: "signup",
      });
      return account;
    });
  }

  async loginCustomerWithPassword(phone: string, password: string) {
    return mutate((db) => {
      const phoneNormalized = normalizePhone(phone);
      const account = db.customerAccounts.find(
        (item) => item.phoneNormalized === phoneNormalized && item.status === "ACTIVE",
      );
      if (!account || !verifyPassword(password, account.passwordHash)) {
        return null;
      }
      if (!isPhoneVerified(account)) {
        throw new DomainError("ยืนยันเบอร์โทรเพื่อทำการจอง");
      }
      account.lastLoginAt = stamp();
      account.updatedAt = account.lastLoginAt;
      audit(db, { kind: "customer", customerAccountId: account.id }, "CUSTOMER_LOGIN", "customer_account", account.id, null, {
        method: "password",
      });
      return account;
    });
  }

  async startForgotPassword(phone: string) {
    const phoneNormalized = normalizePhone(phone);
    const db = await readDb();
    const account = db.customerAccounts.find(
      (item) => item.phoneNormalized === phoneNormalized && item.status === "ACTIVE",
    );
    if (!account) {
      // Do not reveal whether phone exists — still issue OTP to empty sink for timing; here return challenge only if exists
      throw new DomainError("ถ้าเบอร์นี้มีในระบบ จะได้รับรหัสยืนยัน");
    }
    return this.requestCustomerOtp({
      phone,
      purpose: "FORGOT_PASSWORD",
      customerAccountId: account.id,
    });
  }

  async completeForgotPassword(input: { challengeId: string; code: string; password: string }) {
    const verified = await this.verifyCustomerOtp({ challengeId: input.challengeId, code: input.code });
    if (!verified.ok) throw new DomainError("รหัส OTP ไม่ถูกต้องหรือหมดอายุ");
    return mutate((db) => {
      const account = db.customerAccounts.find(
        (item) =>
          item.phoneNormalized === verified.phoneNormalized &&
          item.status === "ACTIVE",
      );
      if (!account) throw new DomainError("ไม่พบบัญชีลูกค้า");
      account.passwordHash = hashPassword(input.password);
      account.phoneVerifiedAt = account.phoneVerifiedAt ?? stamp();
      account.phone = account.phone ?? verified.phoneNormalized;
      account.phoneNormalized = verified.phoneNormalized;
      account.updatedAt = stamp();
      audit(db, { kind: "customer", customerAccountId: account.id }, "CUSTOMER_PASSWORD_RESET", "customer_account", account.id, null, {});
      return account;
    });
  }

  async beginSocialLogin(provider: SocialProvider, returnTo: string) {
    return getOAuthAdapter().begin(provider, returnTo);
  }

  async completeSocialLogin(input: {
    provider: SocialProvider;
    mockToken?: string;
    subjectId?: string;
    email?: string;
    displayName?: string;
  }) {
    const profile = getOAuthAdapter().complete(input.provider, input);
    return mutate((db) => {
      const identity = db.customerIdentities.find(
        (item) =>
          item.provider === input.provider && item.providerSubjectId === profile.providerSubjectId,
      );
      let account: CustomerAccount | null = identity
        ? accountByIdAuth(db, identity.customerAccountId)
        : null;
      const now = stamp();
      if (!account) {
        // Create shell account — phone verification still required before booking.
        account = {
          id: newId(),
          phone: null,
          phoneNormalized: null,
          phoneVerifiedAt: null,
          email: profile.providerEmail,
          displayName: profile.displayName,
          passwordHash: null,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        };
        db.customerAccounts.push(account);
        db.customerIdentities.push({
          id: newId(),
          customerAccountId: account.id,
          provider: input.provider,
          providerSubjectId: profile.providerSubjectId,
          providerEmail: profile.providerEmail,
          linkedAt: now,
        });
        audit(db, { kind: "customer", customerAccountId: account.id }, "CUSTOMER_SOCIAL_LINKED", "customer_account", account.id, null, {
          provider: input.provider,
        });
      } else {
        if (!canLinkSocialToAccount(account)) throw new DomainError("บัญชีถูกระงับ");
        account.lastLoginAt = now;
        account.updatedAt = now;
        if (!identity) {
          db.customerIdentities.push({
            id: newId(),
            customerAccountId: account.id,
            provider: input.provider,
            providerSubjectId: profile.providerSubjectId,
            providerEmail: profile.providerEmail,
            linkedAt: now,
          });
          audit(db, { kind: "customer", customerAccountId: account.id }, "CUSTOMER_SOCIAL_LINKED", "customer_account", account.id, null, {
            provider: input.provider,
          });
        }
      }
      audit(db, { kind: "customer", customerAccountId: account.id }, "CUSTOMER_LOGIN", "customer_account", account.id, null, {
        method: input.provider,
      });
      return account;
    });
  }

  async verifyPhoneForAccount(input: {
    customerAccountId: string;
    challengeId: string;
    code: string;
  }) {
    const verified = await this.verifyCustomerOtp({ challengeId: input.challengeId, code: input.code });
    if (!verified.ok) throw new DomainError("รหัส OTP ไม่ถูกต้องหรือหมดอายุ");
    return mutate((db) => {
      const account = accountByIdAuth(db, input.customerAccountId);
      if (!account || account.status !== "ACTIVE") throw new DomainError("ไม่พบบัญชีลูกค้า");
      const taken = db.customerAccounts.find(
        (item) =>
          item.id !== account.id &&
          item.phoneNormalized === verified.phoneNormalized &&
          item.phoneVerifiedAt,
      );
      if (taken) throw new DomainError("เบอร์นี้ถูกใช้กับบัญชีอื่นแล้ว");
      account.phone = verified.phoneNormalized;
      account.phoneNormalized = verified.phoneNormalized;
      account.phoneVerifiedAt = stamp();
      account.updatedAt = account.phoneVerifiedAt;
      const phoneIdentity = db.customerIdentities.find(
        (item) => item.customerAccountId === account.id && item.provider === "PHONE",
      );
      if (!phoneIdentity) {
        db.customerIdentities.push({
          id: newId(),
          customerAccountId: account.id,
          provider: "PHONE",
          providerSubjectId: verified.phoneNormalized,
          providerEmail: null,
          linkedAt: stamp(),
        });
      } else {
        phoneIdentity.providerSubjectId = verified.phoneNormalized;
      }
      audit(db, { kind: "customer", customerAccountId: account.id }, "CUSTOMER_PHONE_VERIFIED", "customer_account", account.id, null, {
        phoneNormalized: verified.phoneNormalized,
      });
      return account;
    });
  }

  async claimBookingByToken(customerAccountId: string, token: string) {
    return mutate((db) => {
      const account = requireVerifiedCustomerAccount(db, customerAccountId);
      const booking = db.bookings.find((item) => item.securePublicToken === token);
      if (!booking) throw new DomainError("ไม่พบการจอง");
      if (booking.customerAccountId && booking.customerAccountId !== account.id) {
        throw new TenantIsolationError("การจองนี้ผูกกับบัญชีอื่นแล้ว");
      }
      if (!phonesMatch(account.phoneNormalized, booking.customerPhoneSnapshot)) {
        throw new DomainError("เบอร์ที่ยืนยันไม่ตรงกับการจองนี้");
      }
      booking.customerAccountId = account.id;
      booking.updatedAt = stamp();
      audit(db, { kind: "customer", customerAccountId: account.id }, "BOOKING_LINKED_TO_CUSTOMER", "booking", booking.id, booking.businessId, {
        customerAccountId: account.id,
      });
      return booking;
    });
  }

  async listCustomerBookings(customerAccountId: string) {
    const db = await readDb();
    const account = accountByIdAuth(db, customerAccountId);
    if (!account) return [];
    // Authoritative ownership only — never weakly surface unclaimed bookings by phone alone.
    return db.bookings
      .filter((item) => item.customerAccountId === customerAccountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getCustomerBookingRecord(customerAccountId: string, bookingId: string) {
    const db = await readDb();
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) return null;
    const account = accountByIdAuth(db, customerAccountId);
    if (!account) return null;
    if (booking.customerAccountId !== customerAccountId) return null;
    return hydrateBooking(db, booking);
  }

  async recordTripCheckIn(
    actor: Actor,
    bookingId: string,
    input: {
      kind: CheckInKind;
      latitude: number;
      longitude: number;
      accuracyMeters?: number | null;
      overrideReason?: LocationOverrideReason | null;
      note?: string | null;
      now?: string | null;
    },
  ) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      try {
        assertTripOps(actor, input.kind === "PICKUP" ? "CHECK_IN_PICKUP" : "CHECK_IN_DROPOFF");
      } catch (error) {
        throw new DomainError(error instanceof Error ? error.message : "ไม่มีสิทธิ์เช็กอิน");
      }
      if (booking.status !== "CONFIRMED" && booking.status !== "IN_PROGRESS") {
        throw new DomainError("เช็กอินได้เมื่องานยืนยันแล้วหรือกำลังเดินทาง");
      }
      const existing = db.tripCheckIns.find(
        (item) => item.bookingId === booking.id && item.kind === input.kind,
      );
      if (existing) return existing; // idempotent

      const expected =
        input.kind === "PICKUP"
          ? booking.pickupLat != null && booking.pickupLng != null
            ? { latitude: booking.pickupLat, longitude: booking.pickupLng }
            : null
          : booking.dropoffLat != null && booking.dropoffLng != null
            ? { latitude: booking.dropoffLat, longitude: booking.dropoffLng }
            : null;
      const distance =
        expected != null
          ? distanceMeters(expected, { latitude: input.latitude, longitude: input.longitude })
          : null;
      const proximity = proximityBand(distance);
      try {
        assertOverrideAllowed(proximity, input.overrideReason ?? null, input.note);
      } catch (error) {
        throw new DomainError(error instanceof Error ? error.message : "เช็กอินไม่สำเร็จ");
      }

      const now = input.now ?? stamp();
      const row: TripCheckIn = {
        id: newId(),
        businessId: booking.businessId,
        bookingId: booking.id,
        kind: input.kind,
        checkedAt: now,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters ?? null,
        distanceFromExpectedM: distance,
        proximity,
        overrideReason: proximity === "FAR" ? (input.overrideReason ?? null) : null,
        note: input.note?.trim() || null,
        actorUserId: actor.kind === "user" ? actor.userId : null,
        createdAt: now,
      };
      db.tripCheckIns.push(row);
      if (input.kind === "PICKUP") booking.pickupCheckedInAt = now;
      if (input.kind === "DROPOFF") booking.dropoffCheckedInAt = now;
      booking.updatedAt = now;
      audit(
        db,
        actor,
        input.kind === "PICKUP" ? "TRIP_PICKUP_CHECK_IN" : "TRIP_DROPOFF_CHECK_IN",
        "booking",
        booking.id,
        booking.businessId,
        {
          kind: input.kind,
          distanceFromExpectedM: distance,
          proximity,
          overrideReason: row.overrideReason,
          // intentional: do not log raw coordinates in generic audit by default
          hasCoordinates: true,
        },
      );
      return row;
    });
  }

  async startTrip(
    actor: Actor,
    bookingId: string,
    input: { now?: string | null } = {},
  ) {
    return mutate((db) => {
      const booking = db.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new DomainError("ไม่พบคำขอจอง");
      assertBusinessAccess(actor, booking.businessId);
      try {
        assertTripOps(actor, "START_TRIP");
      } catch (error) {
        throw new DomainError(error instanceof Error ? error.message : "ไม่มีสิทธิ์เริ่มงาน");
      }
      if (booking.actualStartAt) return booking; // idempotent
      const pickup = db.tripCheckIns.find(
        (item) => item.bookingId === booking.id && item.kind === "PICKUP",
      );
      if (!pickup) throw new DomainError("ต้องเช็กอินจุดรับก่อนเริ่มงาน");
      const now = input.now ?? stamp();
      booking.actualStartAt = now;
      if (booking.status === "CONFIRMED" && canTransition(booking.status, "IN_PROGRESS")) {
        booking.status = "IN_PROGRESS";
      }
      booking.updatedAt = now;
      audit(db, actor, "TRIP_STARTED", "booking", booking.id, booking.businessId, {
        actualStartAt: now,
      });
      return booking;
    });
  }

  async listTripCheckIns(actor: Actor, bookingId: string) {
    const db = await readDb();
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) return [];
    assertBusinessAccess(actor, booking.businessId);
    return db.tripCheckIns
      .filter((item) => item.bookingId === bookingId)
      .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  }

  async listStaff(actor: Actor, businessId: string) {
    assertBusinessAccess(actor, businessId);
    const db = await readDb();
    assertStorePermission(db, actor, businessId, "STAFF_VIEW");
    return staffOf(db, businessId);
  }

  async inviteStaff(
    actor: Actor,
    businessId: string,
    input: {
      fullName: string;
      email: string;
      phone?: string | null;
      staffRole: StoreStaffRole;
      permissions?: StorePermission[] | null;
    },
  ) {
    return mutate((db) => {
      assertStorePermission(db, actor, businessId, "STAFF_MANAGE");
      if (actor.kind !== "user") throw new DomainError("ต้องเข้าสู่ระบบ");
      if (!STORE_STAFF_ROLES.includes(input.staffRole)) {
        throw new DomainError("บทบาทไม่ถูกต้อง");
      }
      if (input.staffRole === "OWNER") {
        throw new DomainError("ไม่สามารถเชิญเป็นเจ้าของผ่านคำเชิญ — ใช้โอนสิทธิ์เจ้าของแทน");
      }
      const actorPerms = membershipPermissions(actor, db.businessUsers, businessId);
      if (actorPerms !== "SUPER" && (!actorPerms || !actorPerms.includes("STAFF_MANAGE"))) {
        throw new DomainError("ไม่มีสิทธิ์จัดการพนักงาน");
      }
      const grantable =
        actorPerms === "SUPER" ? [...permissionsForRole("OWNER")] : actorPerms ?? [];
      const permissions = sanitizePermissions(
        input.staffRole,
        input.permissions,
        grantable,
      );
      const email = input.email.trim().toLowerCase();
      if (!email.includes("@")) throw new DomainError("อีเมลไม่ถูกต้อง");
      const existingProfile = db.profiles.find((item) => item.email.toLowerCase() === email);
      if (existingProfile) {
        const existingLink = db.businessUsers.find(
          (item) => item.businessId === businessId && item.userId === existingProfile.id,
        );
        if (existingLink?.active) throw new DomainError("อีเมลนี้เป็นพนักงานของร้านอยู่แล้ว");
      }
      const pending = db.staffInvitations.find(
        (item) =>
          item.businessId === businessId &&
          item.email === email &&
          !item.acceptedAt &&
          !item.revokedAt &&
          Date.parse(item.expiresAt) > Date.now(),
      );
      if (pending) throw new DomainError("มีคำเชิญที่ยังไม่หมดอายุสำหรับอีเมลนี้แล้ว");

      const { invitation, rawToken } = createInvitationRecord({
        businessId,
        email,
        phone: input.phone?.trim() || null,
        fullName: input.fullName,
        staffRole: input.staffRole,
        permissions,
        invitedByUserId: actor.userId,
      });
      db.staffInvitations.push(invitation);
      audit(db, actor, "STAFF_INVITED", "staff_invitation", invitation.id, businessId, {
        email,
        staffRole: input.staffRole,
      });
      return {
        invitation,
        inviteUrl: `/invite/${rawToken}`,
        rawToken,
      };
    });
  }

  async revokeStaffInvite(actor: Actor, businessId: string, invitationId: string) {
    return mutate((db) => {
      assertStorePermission(db, actor, businessId, "STAFF_MANAGE");
      const invite = db.staffInvitations.find(
        (item) => item.id === invitationId && item.businessId === businessId,
      );
      if (!invite) throw new DomainError("ไม่พบคำเชิญ");
      if (invite.acceptedAt) throw new DomainError("คำเชิญถูกใช้แล้ว");
      invite.revokedAt = stamp();
      audit(db, actor, "STAFF_INVITE_REVOKED", "staff_invitation", invite.id, businessId, {});
      return invite;
    });
  }

  async getStaffInviteByToken(token: string) {
    const db = await readDb();
    const tokenHash = hashInviteToken(token);
    const invite = db.staffInvitations.find((item) => item.tokenHash === tokenHash);
    if (!invite || invite.revokedAt || invite.acceptedAt) return null;
    if (Date.parse(invite.expiresAt) < Date.now()) return null;
    const business = db.businesses.find((item) => item.id === invite.businessId);
    if (!business) return null;
    return { invitation: invite, business };
  }

  async acceptStaffInvite(input: {
    token: string;
    password: string;
    fullName?: string | null;
  }) {
    return mutate((db) => {
      const tokenHash = hashInviteToken(input.token);
      const invite = db.staffInvitations.find((item) => item.tokenHash === tokenHash);
      if (!invite || invite.revokedAt) throw new DomainError("คำเชิญไม่ถูกต้อง");
      if (invite.acceptedAt) throw new DomainError("คำเชิญถูกใช้แล้ว");
      if (Date.parse(invite.expiresAt) < Date.now()) throw new DomainError("คำเชิญหมดอายุ");
      if (!input.password || input.password.length < 8) {
        throw new DomainError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      }

      let profile = db.profiles.find((item) => item.email.toLowerCase() === invite.email);
      const now = stamp();
      if (!profile) {
        profile = {
          id: newId(),
          email: invite.email,
          fullName: input.fullName?.trim() || invite.fullName,
          role: legacyRoleFromStaffRole(invite.staffRole),
          active: true,
          passwordHash: input.password,
        };
        db.profiles.push(profile);
      } else {
        if (!profile.active) throw new DomainError("บัญชีนี้ถูกระงับ");
        profile.passwordHash = input.password;
        profile.fullName = input.fullName?.trim() || invite.fullName || profile.fullName;
        profile.role = legacyRoleFromStaffRole(invite.staffRole);
      }

      const existing = db.businessUsers.find(
        (item) => item.businessId === invite.businessId && item.userId === profile!.id,
      );
      if (existing) {
        existing.active = true;
        existing.staffRole = invite.staffRole;
        existing.permissions = invite.permissions;
        existing.role = legacyRoleFromStaffRole(invite.staffRole);
        existing.phone = invite.phone;
        existing.lastLoginAt = now;
      } else {
        db.businessUsers.push({
          id: newId(),
          businessId: invite.businessId,
          userId: profile.id,
          role: legacyRoleFromStaffRole(invite.staffRole),
          staffRole: invite.staffRole,
          permissions: invite.permissions,
          phone: invite.phone,
          lastLoginAt: now,
          active: true,
        });
      }
      invite.acceptedAt = now;
      audit(
        db,
        { kind: "user", userId: profile.id, role: profile.role, businessIds: [invite.businessId] },
        "STAFF_INVITE_ACCEPTED",
        "staff_invitation",
        invite.id,
        invite.businessId,
        {},
      );
      return { profile, businessId: invite.businessId };
    });
  }

  async updateStaffMember(
    actor: Actor,
    businessId: string,
    membershipId: string,
    input: {
      staffRole?: StoreStaffRole;
      permissions?: StorePermission[] | null;
      active?: boolean;
    },
  ) {
    return mutate((db) => {
      assertStorePermission(db, actor, businessId, "STAFF_MANAGE");
      if (actor.kind !== "user") throw new DomainError("ต้องเข้าสู่ระบบ");
      const link = db.businessUsers.find(
        (item) => item.id === membershipId && item.businessId === businessId,
      );
      if (!link) throw new DomainError("ไม่พบพนักงาน");

      const owners = db.businessUsers.filter(
        (item) => item.businessId === businessId && item.staffRole === "OWNER" && item.active,
      );
      if (
        link.staffRole === "OWNER" &&
        ((input.active === false && owners.length <= 1) ||
          (input.staffRole && input.staffRole !== "OWNER" && owners.length <= 1))
      ) {
        throw new DomainError("ต้องเหลือเจ้าของร้านอย่างน้อย 1 คน");
      }

      if (input.staffRole === "OWNER" && link.userId === actor.userId) {
        // ok
      }
      if (input.staffRole && input.staffRole !== link.staffRole) {
        if (input.staffRole === "OWNER") {
          // Only existing OWNER can promote
          const actorLink = db.businessUsers.find(
            (item) => item.businessId === businessId && item.userId === actor.userId && item.active,
          );
          if (actor.role !== "SUPER_ADMIN" && actorLink?.staffRole !== "OWNER") {
            throw new DomainError("เฉพาะเจ้าของร้านเท่านั้นที่โอนสิทธิ์เจ้าของได้");
          }
        }
        link.staffRole = input.staffRole;
        link.role = legacyRoleFromStaffRole(input.staffRole);
        const profile = db.profiles.find((item) => item.id === link.userId);
        if (profile && profile.role !== "SUPER_ADMIN") {
          profile.role = legacyRoleFromStaffRole(input.staffRole);
        }
        audit(db, actor, "STAFF_ROLE_CHANGED", "business_user", link.id, businessId, {
          staffRole: input.staffRole,
        });
      }

      if (input.permissions) {
        const actorPerms = membershipPermissions(actor, db.businessUsers, businessId);
        const grantable =
          actorPerms === "SUPER" ? [...permissionsForRole("OWNER")] : actorPerms ?? [];
        // Cannot grant beyond own
        link.permissions = sanitizePermissions(
          link.staffRole,
          input.permissions,
          grantable,
        );
        audit(db, actor, "STAFF_PERMISSIONS_CHANGED", "business_user", link.id, businessId, {
          permissions: link.permissions,
        });
      }

      if (input.active === false) {
        link.active = false;
        audit(db, actor, "STAFF_SUSPENDED", "business_user", link.id, businessId, {});
      }
      if (input.active === true) {
        link.active = true;
        const profile = db.profiles.find((item) => item.id === link.userId);
        if (profile) profile.active = true;
        audit(db, actor, "STAFF_REACTIVATED", "business_user", link.id, businessId, {});
      }

      return normalizeBusinessUser(link);
    });
  }

  async removeStaffMember(actor: Actor, businessId: string, membershipId: string) {
    return mutate((db) => {
      assertStorePermission(db, actor, businessId, "STAFF_MANAGE");
      const link = db.businessUsers.find(
        (item) => item.id === membershipId && item.businessId === businessId,
      );
      if (!link) throw new DomainError("ไม่พบพนักงาน");
      const owners = db.businessUsers.filter(
        (item) => item.businessId === businessId && item.staffRole === "OWNER" && item.active,
      );
      if (link.staffRole === "OWNER" && owners.length <= 1) {
        throw new DomainError("ต้องเหลือเจ้าของร้านอย่างน้อย 1 คน");
      }
      if (actor.kind === "user" && link.userId === actor.userId) {
        throw new DomainError("ไม่สามารถลบตัวเองออกจากร้าน");
      }
      link.active = false;
      audit(db, actor, "STAFF_SUSPENDED", "business_user", link.id, businessId, {
        removed: true,
      });
      return link;
    });
  }

  async assertActiveStoreMembership(userId: string, businessId: string) {
    const db = await readDb();
    const profile = db.profiles.find((item) => item.id === userId);
    if (!profile?.active) return false;
    if (profile.role === "SUPER_ADMIN") return true;
    return db.businessUsers.some(
      (item) => item.businessId === businessId && item.userId === userId && item.active,
    );
  }
}

function staffOf(db: Db, businessId: string): StaffMember[] {
  return buildStaffDirectory(businessId, db.businessUsers, db.profiles, db.staffInvitations);
}

function assertStorePermission(db: Db, actor: Actor, businessId: string, permission: StorePermission) {
  assertBusinessAccess(actor, businessId);
  if (!actorHasPermission(actor, db.businessUsers, businessId, permission)) {
    throw new DomainError(`ไม่มีสิทธิ์ ${permission}`);
  }
}

/**
 * Plan caps on active fleet size. Applies to CREATE only — an existing row is
 * never retro-blocked, and a `null` cap means product has not finalized a number
 * for that plan, so none is invented here.
 */
function assertPlanResourceHeadroom(
  db: Db,
  businessId: string,
  resource: "vehicles" | "drivers",
) {
  const business = db.businesses.find((item) => item.id === businessId);
  if (!business) throw new DomainError("ไม่พบร้าน");
  const limits = planResourceLimits(business.subscriptionPlan);
  const max = resource === "vehicles" ? limits.maxVehicles : limits.maxDrivers;
  if (max === null) return;
  const rows = resource === "vehicles" ? db.vehicles : db.drivers;
  const active = rows.filter(
    (item) => item.businessId === businessId && item.active !== false,
  ).length;
  if (active >= max) throw new DomainError(planResourceLimitMessage(resource, max));
}

function assertTripPackagesEntitlement(db: Db, businessId: string) {
  const business = db.businesses.find((item) => item.id === businessId);
  if (!business) throw new DomainError("ไม่พบร้าน");
  if (!allowsTripPackages(business.subscriptionPlan)) {
    throw new DomainError(
      PLAN_UNLOCK_HINT["storefront.tripPackages"] || "แพ็กเกจปัจจุบันยังไม่รองรับแพ็กเกจทริป",
    );
  }
}

function requireTripPackage(db: Db, id: string): TripPackage {
  const pkg = db.tripPackages.find((item) => item.id === id);
  if (!pkg) throw new DomainError("ไม่พบแพ็กเกจทริป");
  return pkg;
}

function normalizeLocalizedText(
  value: { th?: string; en?: string; zh?: string } | null | undefined,
  requiredTh: boolean,
): { th: string; en?: string; zh?: string } {
  const th = value?.th?.trim() ?? "";
  if (requiredTh && !th) throw new DomainError("กรุณาระบุชื่อ/ข้อความภาษาไทย");
  const next: { th: string; en?: string; zh?: string } = { th };
  const en = value?.en?.trim();
  const zh = value?.zh?.trim();
  if (en) next.en = en;
  if (zh) next.zh = zh;
  return next;
}

function normalizeLocalizedList(
  value: { th?: string[]; en?: string[]; zh?: string[] } | null | undefined,
): { th: string[]; en?: string[]; zh?: string[] } {
  const clean = (list: string[] | undefined) =>
    (list ?? []).map((item) => item.trim()).filter(Boolean);
  const next: { th: string[]; en?: string[]; zh?: string[] } = { th: clean(value?.th) };
  const en = clean(value?.en);
  const zh = clean(value?.zh);
  if (en.length) next.en = en;
  if (zh.length) next.zh = zh;
  return next;
}

function normalizeOptionalLocalized(
  value: { th?: string; en?: string; zh?: string } | null | undefined,
): { th?: string; en?: string; zh?: string } {
  const next: { th?: string; en?: string; zh?: string } = {};
  const th = value?.th?.trim();
  const en = value?.en?.trim();
  const zh = value?.zh?.trim();
  if (th) next.th = th;
  if (en) next.en = en;
  if (zh) next.zh = zh;
  return next;
}

function normalizeItinerary(input: TripPackageWriteInput["itinerary"]): TripPackage["itinerary"] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new DomainError("กรุณาระบุแผนการเดินทางอย่างน้อย 1 วัน");
  }
  return input.map((day, index) => ({
    dayNumber: typeof day.dayNumber === "number" ? day.dayNumber : index + 1,
    title: normalizeLocalizedText(day.title, true),
    description: normalizeLocalizedText(day.description, true),
    stops: (day.stops ?? []).map((stop) => ({
      placeId: stop.placeId ?? null,
      title: normalizeLocalizedText(stop.title, true),
      timeApprox: stop.timeApprox?.trim() || null,
      note: stop.note?.trim() || null,
    })),
  }));
}

function normalizeTripPackageWrite(input: TripPackageWriteInput) {
  const days = Math.max(1, Math.floor(input.days) || 1);
  const nights = Math.max(0, Math.floor(input.nights) || 0);
  const passengerMin = Math.max(1, Math.floor(input.passengerMin) || 1);
  const passengerMax = Math.max(passengerMin, Math.floor(input.passengerMax) || passengerMin);
  const quoteFirst = input.quoteFirst !== false;
  const startingPrice =
    quoteFirst || input.startingPrice == null
      ? null
      : Math.max(0, Number(input.startingPrice) || 0);
  const galleryImageUrls = Array.isArray(input.galleryImageUrls)
    ? input.galleryImageUrls.filter((url) => typeof url === "string" && url.trim()).slice(0, 12)
    : [];
  const coverImageUrl = input.coverImageUrl?.trim() || galleryImageUrls[0] || null;

  return {
    days,
    nights,
    passengerMin,
    passengerMax,
    vehicleCategoryHint: input.vehicleCategoryHint?.trim() || null,
    startingPrice,
    quoteFirst: quoteFirst || startingPrice == null,
    coverImageUrl,
    galleryImageUrls,
    title: normalizeLocalizedText(input.title, true),
    summary: normalizeLocalizedText(input.summary, true),
    highlights: normalizeLocalizedList(input.highlights),
    included: normalizeLocalizedList(input.included),
    notIncluded: normalizeLocalizedList(input.notIncluded),
    conditions: normalizeOptionalLocalized(input.conditions),
    notes: normalizeOptionalLocalized(input.notes),
    itinerary: normalizeItinerary(input.itinerary),
  };
}

function applyTripPackagePatch(pkg: TripPackage, input: TripPackageUpdateInput) {
  const merged: TripPackageWriteInput = {
    featured: input.featured ?? pkg.featured,
    displayOrder: input.displayOrder ?? pkg.displayOrder,
    days: input.days ?? pkg.days,
    nights: input.nights ?? pkg.nights,
    passengerMin: input.passengerMin ?? pkg.passengerMin,
    passengerMax: input.passengerMax ?? pkg.passengerMax,
    vehicleCategoryHint:
      input.vehicleCategoryHint !== undefined ? input.vehicleCategoryHint : pkg.vehicleCategoryHint,
    startingPrice: input.startingPrice !== undefined ? input.startingPrice : pkg.startingPrice,
    quoteFirst: input.quoteFirst ?? pkg.quoteFirst,
    coverImageUrl: input.coverImageUrl !== undefined ? input.coverImageUrl : pkg.coverImageUrl,
    galleryImageUrls:
      input.galleryImageUrls !== undefined ? input.galleryImageUrls : pkg.galleryImageUrls,
    title: input.title ?? pkg.title,
    summary: input.summary ?? pkg.summary,
    highlights: input.highlights ?? pkg.highlights,
    included: input.included ?? pkg.included,
    notIncluded: input.notIncluded ?? pkg.notIncluded,
    conditions: input.conditions ?? pkg.conditions,
    notes: input.notes ?? pkg.notes,
    itinerary: input.itinerary ?? pkg.itinerary,
  };
  const normalized = normalizeTripPackageWrite(merged);
  return {
    featured: Boolean(merged.featured),
    displayOrder: typeof merged.displayOrder === "number" ? merged.displayOrder : pkg.displayOrder,
    ...normalized,
  };
}

function applyTripPackageStatus(pkg: TripPackage, status: TripPackageStatus) {
  if (status === "PUBLISHED") {
    if (!pkg.title.th.trim() || !pkg.itinerary.length) {
      throw new DomainError("ต้องมีชื่อและแผนการเดินทางก่อนเผยแพร่");
    }
    pkg.status = "PUBLISHED";
    pkg.publishedAt = pkg.publishedAt ?? stamp();
  } else if (status === "UNPUBLISHED") {
    pkg.status = "UNPUBLISHED";
  } else if (status === "ARCHIVED") {
    pkg.status = "ARCHIVED";
  } else if (status === "DRAFT") {
    pkg.status = "DRAFT";
  } else {
    throw new DomainError("สถานะแพ็กเกจไม่ถูกต้อง");
  }
  pkg.updatedAt = stamp();
}

function requireBooking(db: Db, bookingId: string) {
  const booking = db.bookings.find((item) => item.id === bookingId);
  if (!booking) throw new DomainError("ไม่พบคำขอจอง");
  return booking;
}

function requireQuotation(db: Db, quotationId: string) {
  const quotation = db.quotations.find((item) => item.id === quotationId);
  if (!quotation) throw new DomainError("ไม่พบใบเสนอราคา");
  return quotation;
}

function itemsOf(db: Db, quotationId: string) {
  return db.quotationItems
    .filter((item) => item.quotationId === quotationId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function persistExpired(quotation: Quotation) {
  if (quotation.status === "SENT" && isQuotationExpired(quotation)) {
    quotation.status = "EXPIRED";
    quotation.updatedAt = stamp();
  }
}

function hydrateQuotation(db: Db, quotation: Quotation): QuotationRecord {
  return {
    ...quotation,
    includedHoursPerDay: quotation.includedHoursPerDay ?? null,
    overtimeRatePerHour: quotation.overtimeRatePerHour ?? null,
    status: effectiveQuotationStatus(quotation),
    items: itemsOf(db, quotation.id),
  };
}

function hydrateQuotations(db: Db, bookingId: string) {
  return db.quotations
    .filter((item) => item.bookingId === bookingId)
    .map((item) => hydrateQuotation(db, item))
    .sort((a, b) => a.version - b.version);
}

function replaceItems(db: Db, quotation: Quotation, items: QuotationDraftInput["items"]) {
  db.quotationItems = db.quotationItems.filter((item) => item.quotationId !== quotation.id);
  items.forEach((item, index) => {
    db.quotationItems.push({
      id: item.id ?? newId(),
      businessId: quotation.businessId,
      quotationId: quotation.id,
      type: item.type,
      description: item.description.trim(),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: lineAmount(item.quantity, item.unitPrice),
      sortOrder: index,
      note: item.note?.trim() || null,
    });
  });
}

function safeTotals(
  items: QuotationDraftInput["items"],
  discountAmount: number,
  depositType: Quotation["depositType"],
  depositValue: number,
) {
  try {
    return calculateQuotationTotals(items, discountAmount, depositType, depositValue);
  } catch (error) {
    throw new DomainError(error instanceof Error ? error.message : "ยอดไม่ถูกต้อง");
  }
}

function applyDraftInput(db: Db, quotation: Quotation, input: QuotationDraftInput) {
  replaceItems(db, quotation, input.items);
  const totals = safeTotals(input.items, input.discountAmount ?? 0, input.depositType, input.depositValue ?? 0);
  quotation.subtotal = totals.subtotal;
  quotation.discountAmount = totals.discountAmount;
  quotation.totalAmount = totals.totalAmount;
  quotation.depositType = input.depositType;
  quotation.depositValue = input.depositValue ?? 0;
  quotation.depositRequiredAmount = totals.depositRequiredAmount;
  quotation.balanceAmount = totals.balanceAmount;
  quotation.note = input.note?.trim() || null;
  quotation.terms = input.terms?.trim() || null;
  if (input.includedHoursPerDay !== undefined) {
    quotation.includedHoursPerDay = input.includedHoursPerDay;
  }
  if (input.overtimeRatePerHour !== undefined) {
    quotation.overtimeRatePerHour = input.overtimeRatePerHour;
  }
  quotation.validUntil = input.validUntil || null;
}

function createDraftFrom(db: Db, actor: Actor, booking: Booking, source: Quotation | null): QuotationRecord {
  const now = stamp();
  const settings = db.settings.find((item) => item.businessId === booking.businessId);
  const prefix = settings?.ops?.quotationPrefix?.trim() || "QT";
  const version = source
    ? Math.max(...db.quotations.filter((item) => item.bookingId === booking.id).map((item) => item.version), 0) + 1
    : (db.quotations.filter((item) => item.bookingId === booking.id).reduce((max, item) => Math.max(max, item.version), 0) || 0) + 1;
  const quotationNumber = source?.quotationNumber
    ?? nextQuotationNumber(
      db.quotations.filter((item) => item.businessId === booking.businessId).map((item) => item.quotationNumber),
      prefix,
    );
  const vehicle = booking.assignedVehicleId
    ? db.vehicles.find((item) => item.id === booking.assignedVehicleId) ?? null
    : booking.preferredVehicleId
      ? db.vehicles.find((item) => item.id === booking.preferredVehicleId) ?? null
      : null;
  const seeded = source
    ? itemsOf(db, source.id).map((item) => ({
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        note: item.note,
      }))
    : seedQuotationLines(booking, vehicle);
  const depositType = source?.depositType
    ?? (settings?.defaultDepositPercent ? "PERCENTAGE" : "NONE");
  const depositValue = source?.depositValue ?? settings?.defaultDepositPercent ?? 0;
  const totals = safeTotals(seeded, source?.discountAmount ?? 0, depositType, depositValue);
  const includedHoursPerDay =
    source?.includedHoursPerDay ?? settings?.ops?.includedHoursPerDay ?? null;
  const overtimeRatePerHour =
    source?.overtimeRatePerHour ?? settings?.ops?.overtimeRatePerHour ?? null;
  const quotation: Quotation = {
    id: newId(),
    businessId: booking.businessId,
    bookingId: booking.id,
    quotationNumber,
    version,
    status: "DRAFT",
    currency: "THB",
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    totalAmount: totals.totalAmount,
    depositType,
    depositValue,
    depositRequiredAmount: totals.depositRequiredAmount,
    balanceAmount: totals.balanceAmount,
    note: source?.note ?? null,
    terms: source?.terms ?? DEFAULT_QUOTATION_TERMS,
    includedHoursPerDay,
    overtimeRatePerHour,
    validUntil: source?.validUntil ?? null,
    sentAt: null,
    acceptedAt: null,
    rejectedAt: null,
    changeRequestText: null,
    changeRequestedAt: null,
    rejectReason: null,
    createdBy: actor.kind === "user" ? actor.userId : null,
    createdAt: now,
    updatedAt: now,
  };
  db.quotations.push(quotation);
  replaceItems(db, quotation, seeded);
  const moneyIn = db.moneyMovements.some((item) => item.bookingId === booking.id && item.direction === "IN");
  audit(db, actor, "QUOTATION_CREATED", "quotation", quotation.id, quotation.businessId, {
    bookingId: booking.id,
    quotationId: quotation.id,
    version: quotation.version,
    clonedFrom: source?.id ?? null,
    amendment: Boolean(source),
    moneyAlreadyReceived: source?.status === "CUSTOMER_ACCEPTED" && moneyIn,
    flag: source?.status === "CUSTOMER_ACCEPTED" && moneyIn ? "มีการรับเงินตามใบเสนอราคาเดิมแล้ว" : null,
  });
  return hydrateQuotation(db, quotation);
}

function requireActiveDriverJob(db: Db, token: string) {
  if (!token || token.length < 20) throw new DomainError("ลิงก์งานไม่ถูกต้อง");
  const link = db.driverJobLinks.find(
    (item) => item.secureToken === token && item.status === "ACTIVE",
  );
  if (!link) throw new DomainError("ลิงก์งานหมดอายุหรือถูกยกเลิก");
  const booking = db.bookings.find((item) => item.id === link.bookingId);
  if (!booking) throw new DomainError("ไม่พบคำขอจอง");
  const actor: Actor = { kind: "driver_job", token, jobLinkId: link.id };
  return { link, booking, actor };
}

function hydrateDriverJob(db: Db, token: string): DriverJobRecord | null {
  const link = db.driverJobLinks.find(
    (item) => item.secureToken === token && item.status === "ACTIVE",
  );
  if (!link) return null;
  const booking = db.bookings.find((item) => item.id === link.bookingId);
  if (!booking) return null;
  const business = db.businesses.find((item) => item.id === booking.businessId);
  if (!business) return null;
  return {
    link,
    booking,
    business,
    vehicle: link.vehicleId
      ? db.vehicles.find((item) => item.id === link.vehicleId) ?? null
      : booking.assignedVehicleId
        ? db.vehicles.find((item) => item.id === booking.assignedVehicleId) ?? null
        : null,
    driver: db.drivers.find((item) => item.id === link.driverId) ?? null,
    itinerary: db.itinerary
      .filter((item) => item.bookingId === booking.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || (a.dayNumber ?? 0) - (b.dayNumber ?? 0)),
    dayLogs: db.driverDayLogs
      .filter((item) => item.driverJobLinkId === link.id)
      .sort((a, b) => a.dayNumber - b.dayNumber),
    suggestions: db.driverRouteSuggestions
      .filter((item) => item.driverJobLinkId === link.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    notes: db.bookingNotes
      .filter((item) => item.bookingId === booking.id && item.audience === "CUSTOMER")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    brand: {
      name: business.name,
      shortName: business.shortName,
      logoUrl: business.logoUrl,
      logoMarkUrl: business.logoMarkUrl,
      primaryColor: business.primaryColor,
      secondaryColor: business.secondaryColor,
      accentColor: business.accentColor,
      phone: business.phone,
      customerSupportText: business.customerSupportText,
    },
  };
}

function hydrateBooking(db: Db, booking: Booking): BookingRecord {
  const business = db.businesses.find((item) => item.id === booking.businessId);
  if (!business) throw new DomainError("ร้านของคำจองนี้หายไป");
  return {
    booking,
    itinerary: db.itinerary
      .filter((item) => item.bookingId === booking.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    vehicle: booking.assignedVehicleId
      ? db.vehicles.find((item) => item.id === booking.assignedVehicleId) ?? null
      : null,
    preferredVehicle: booking.preferredVehicleId
      ? db.vehicles.find((item) => item.id === booking.preferredVehicleId) ?? null
      : null,
    driver: booking.assignedDriverId
      ? db.drivers.find((item) => item.id === booking.assignedDriverId) ?? null
      : null,
    business,
    customer:
      db.customers.find((item) => item.id === booking.customerId) ?? null,
    notes: db.bookingNotes
      .filter((item) => item.bookingId === booking.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    movements: db.moneyMovements
      .filter((item) => item.bookingId === booking.id)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    proofs: db.paymentProofs
      .filter((item) => item.bookingId === booking.id)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    receivingAccount: accountForBooking(booking.receivingAccountId, accountsOf(db, booking.businessId)),
    quotations: hydrateQuotations(db, booking.id),
    auditLogs: db.auditLogs
      .filter((item) => item.entityId === booking.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tripCheckIns: db.tripCheckIns
      .filter((item) => item.bookingId === booking.id)
      .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt)),
  };
}

export const localStore = new LocalStore();

export async function purgeCustomerAuthFixtures(phonePrefix: string) {
  return mutate((db) => {
    const accounts = db.customerAccounts.filter(
      (item) =>
        (item.phoneNormalized && item.phoneNormalized.startsWith(phonePrefix)) ||
        (item.displayName && item.displayName.startsWith("TEST_AUTH_")) ||
        (item.email && item.email.includes("test-auth")),
    );
    const ids = new Set(accounts.map((item) => item.id));
    db.customerAccounts = db.customerAccounts.filter((item) => !ids.has(item.id));
    db.customerIdentities = db.customerIdentities.filter((item) => !ids.has(item.customerAccountId));
    db.otpChallenges = db.otpChallenges.filter(
      (item) => !item.phoneNormalized.startsWith(phonePrefix) && !(item.customerAccountId && ids.has(item.customerAccountId)),
    );
    for (const booking of db.bookings) {
      if (booking.customerAccountId && ids.has(booking.customerAccountId)) {
        booking.customerAccountId = null;
      }
    }
    return accounts.length;
  });
}

export async function purgeTestBookings(clientRequestIds: string[]) {
  const removed = await mutate((db) => {
    const targets = db.bookings.filter((item) => clientRequestIds.includes(item.clientRequestId));
    const bookingIds = new Set(targets.map((item) => item.id));
    const slips = db.slipFiles.filter((item) => bookingIds.has(item.bookingId));
    db.bookings = db.bookings.filter((item) => !bookingIds.has(item.id));
    db.itinerary = db.itinerary.filter((item) => !bookingIds.has(item.bookingId));
    db.bookingNotes = db.bookingNotes.filter((item) => !bookingIds.has(item.bookingId));
    db.tripCheckIns = db.tripCheckIns.filter((item) => !bookingIds.has(item.bookingId));
    db.driverJobLinks = db.driverJobLinks.filter((item) => !bookingIds.has(item.bookingId));
    db.driverDayLogs = db.driverDayLogs.filter((item) => !bookingIds.has(item.bookingId));
    db.driverRouteSuggestions = db.driverRouteSuggestions.filter(
      (item) => !bookingIds.has(item.bookingId),
    );
    db.moneyMovements = db.moneyMovements.filter((item) => !bookingIds.has(item.bookingId));
    db.paymentProofs = db.paymentProofs.filter((item) => !bookingIds.has(item.bookingId));
    const quoteIds = new Set(db.quotations.filter((item) => bookingIds.has(item.bookingId)).map((item) => item.id));
    db.quotations = db.quotations.filter((item) => !bookingIds.has(item.bookingId));
    db.quotationItems = db.quotationItems.filter((item) => !quoteIds.has(item.quotationId));
    db.slipFiles = db.slipFiles.filter((item) => !bookingIds.has(item.bookingId));
    db.analytics = db.analytics.filter((item) => !item.bookingId || !bookingIds.has(item.bookingId));
    db.auditLogs = db.auditLogs.filter((item) => {
      const bookingId = typeof item.metadata.bookingId === "string" ? item.metadata.bookingId : null;
      return !bookingIds.has(item.entityId ?? "") && (!bookingId || !bookingIds.has(bookingId));
    });
    const purgedCustomerIds = new Set(targets.map((item) => item.customerId).filter((id): id is string => Boolean(id)));
    const remainingCustomerIds = new Set(db.bookings.map((item) => item.customerId).filter((id): id is string => Boolean(id)));
    db.customers = db.customers.filter((item) => remainingCustomerIds.has(item.id) || !purgedCustomerIds.has(item.id));
    return slips;
  });
  for (const file of removed) {
    await deletePrivateSlip(file.businessId, file.id, file.ext);
  }
}

export async function purgeTestPaymentAccounts(displayNamePrefix: string) {
  return mutate((db) => {
    const before = db.paymentAccounts.length;
    db.paymentAccounts = db.paymentAccounts.filter((item) => !item.displayName.startsWith(displayNamePrefix));
    return before - db.paymentAccounts.length;
  });
}

export async function purgeByClientRequestPrefix(prefix: string) {
  const db = await readDb();
  const ids = db.bookings
    .filter((item) => item.clientRequestId.startsWith(prefix))
    .map((item) => item.clientRequestId);
  if (ids.length) await purgeTestBookings(ids);
  return ids;
}

/** Test-only: set SaaS plan without going through Platform Admin. */
export async function setBusinessSubscriptionPlanForTests(
  businessId: string,
  plan: string | null,
) {
  return mutate((db) => {
    const business = db.businesses.find((item) => item.id === businessId);
    if (!business) throw new DomainError("ไม่พบร้าน");
    business.subscriptionPlan = plan;
    business.updatedAt = stamp();
    return business.subscriptionPlan;
  });
}

export async function purgeIdentifiedFixtures() {
  const removed = await mutate((db) => {
    const bookings = db.bookings.filter((item) => isFixtureBooking(item));
    const bookingIds = new Set(bookings.map((item) => item.id));
    const vehicles = db.vehicles.filter((item) => isFixtureVehicle(item));
    const drivers = db.drivers.filter((item) => isFixtureDriver(item));
    const vehicleIds = new Set(vehicles.map((item) => item.id));
    const driverIds = new Set(drivers.map((item) => item.id));
    const slips = db.slipFiles.filter((item) => bookingIds.has(item.bookingId));
    const movements = db.moneyMovements.filter((item) => bookingIds.has(item.bookingId));
    const slipFiles = slips.map((item) => ({ businessId: item.businessId, id: item.id, ext: item.ext }));
    db.bookings = db.bookings.filter((item) => !bookingIds.has(item.id));
    db.itinerary = db.itinerary.filter((item) => !bookingIds.has(item.bookingId));
    db.bookingNotes = db.bookingNotes.filter((item) => !bookingIds.has(item.bookingId));
    db.tripCheckIns = db.tripCheckIns.filter((item) => !bookingIds.has(item.bookingId));
    db.driverJobLinks = db.driverJobLinks.filter((item) => !bookingIds.has(item.bookingId));
    db.driverDayLogs = db.driverDayLogs.filter((item) => !bookingIds.has(item.bookingId));
    db.driverRouteSuggestions = db.driverRouteSuggestions.filter(
      (item) => !bookingIds.has(item.bookingId),
    );
    db.moneyMovements = db.moneyMovements.filter((item) => !bookingIds.has(item.bookingId));
    db.paymentProofs = db.paymentProofs.filter((item) => !bookingIds.has(item.bookingId));
    const quoteIds = new Set(db.quotations.filter((item) => bookingIds.has(item.bookingId)).map((item) => item.id));
    db.quotations = db.quotations.filter((item) => !bookingIds.has(item.bookingId));
    db.quotationItems = db.quotationItems.filter((item) => !quoteIds.has(item.quotationId));
    db.slipFiles = db.slipFiles.filter((item) => !bookingIds.has(item.bookingId));
    db.analytics = db.analytics.filter((item) => !item.bookingId || !bookingIds.has(item.bookingId));
    db.vehicles = db.vehicles.filter((item) => !vehicleIds.has(item.id));
    db.drivers = db.drivers.filter((item) => !driverIds.has(item.id));
    const leftoverBookingCustomerIds = new Set(
      db.bookings.map((item) => item.customerId).filter((id): id is string => Boolean(id)),
    );
    const fixtureCustomerIds = new Set(
      bookings.map((item) => item.customerId).filter((id): id is string => Boolean(id)),
    );
    const customers = db.customers.filter(
      (item) =>
        !leftoverBookingCustomerIds.has(item.id) &&
        (isFixtureCustomer(item) || fixtureCustomerIds.has(item.id)),
    );
    const customerIds = new Set(customers.map((item) => item.id));
    db.customers = db.customers.filter((item) => !customerIds.has(item.id));
    db.auditLogs = db.auditLogs.filter((item) => {
      const bookingId = typeof item.metadata.bookingId === "string" ? item.metadata.bookingId : null;
      return !bookingIds.has(item.entityId ?? "") && (!bookingId || !bookingIds.has(bookingId));
    });
    return {
      bookings: bookings.map((item) => ({
        id: item.id,
        bookingCode: item.bookingCode,
        clientRequestId: item.clientRequestId,
        customerNameSnapshot: item.customerNameSnapshot,
      })),
      vehicles: vehicles.map((item) => ({ id: item.id, model: item.model })),
      drivers: drivers.map((item) => ({ id: item.id, name: item.name })),
      customers: customers.map((item) => ({ id: item.id, name: item.name, phone: item.phone })),
      movements: movements.length,
      slips: slips.length,
      slipFiles,
    };
  });
  for (const file of removed.slipFiles) {
    await deletePrivateSlip(file.businessId, file.id, file.ext);
  }
  return removed;
}

export async function persistLegacyMovementBackfill() {
  return mutate((db) => {
    let filled = 0;
    let unknown = 0;
    for (const item of db.moneyMovements) {
      if (!item.receivingAccountSnapshot && item.receivingAccountId) {
        const account = accountById(db, item.businessId, item.receivingAccountId);
        if (account) {
          item.receivingAccountSnapshot = snapshotAccount(account);
          filled += 1;
        }
      }
      if (!item.sourceAccountSnapshot && item.sourceAccountId) {
        const account = accountById(db, item.businessId, item.sourceAccountId);
        if (account) {
          item.sourceAccountSnapshot = snapshotAccount(account);
          filled += 1;
        }
      }
      item.legacyAccountUnknown = !item.receivingAccountSnapshot && !item.sourceAccountSnapshot;
      if (item.legacyAccountUnknown) unknown += 1;
    }
    return { filled, unknown, total: db.moneyMovements.length };
  });
}
