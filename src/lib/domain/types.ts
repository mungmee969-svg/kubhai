import type {
  AnalyticEventName,
  BookingSource,
  BookingStatus,
  BusinessStatus,
  CustomerType,
  DriverType,
  OwnershipType,
  PlaceCategory,
  QuotationDepositType,
  QuotationItemType,
  QuotationStatus,
  Role,
  ServiceType,
} from "./enums";

export type IsoDateTime = string;
export type Uuid = string;

export type Region = {
  id: Uuid;
  nameTh: string;
  nameEn: string;
  sortOrder: number;
};

export type Province = {
  id: Uuid;
  regionId: Uuid;
  nameTh: string;
  nameEn: string;
  slug: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

/** Store-authored local tip — never auto-fabricated claims. */
export type StoreTip = {
  id: Uuid;
  title: string;
  shortText: string;
  serviceType: ServiceType | null;
  placeId: Uuid | null;
  locationKeyword: string | null;
  category: PlaceCategory | null;
  minPassengers: number | null;
  minLuggage: number | null;
  multiDayOnly: boolean;
  active: boolean;
  priority: number;
  /** Where this tip may appear. Empty = all surfaces. */
  surfaces: Array<"WIZARD" | "DETAIL" | "QUOTATION">;
};

export type StoreOpsConfig = {
  minAdvanceHours: number | null;
  serviceHours: string | null;
  cancellationPolicy: string | null;
  customerInstructions: string | null;
  overtimeNote: string | null;
  /** Default included service hours per day for quotation terms (not revenue). */
  includedHoursPerDay: number | null;
  /** Default OT rate THB/hour for quotation terms (not revenue until post-service). */
  overtimeRatePerHour: number | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  promptpay: string | null;
  quotationPrefix: string | null;
  taxInvoiceName: string | null;
  taxId: string | null;
};

export type BusinessSettings = {
  id: Uuid;
  businessId: Uuid;
  faq: FaqItem[];
  /** Contextual store tips shown during customer booking (store-authored). */
  tips: StoreTip[];
  bookingNotes: string | null;
  defaultDepositPercent: number | null;
  allowPartnerVehicles: boolean;
  ops: StoreOpsConfig | null;
};

export type StaffMember = {
  userId: Uuid;
  membershipId: Uuid;
  email: string;
  fullName: string;
  phone: string | null;
  role: Extract<Role, "BUSINESS_OWNER" | "BUSINESS_STAFF" | "SUPER_ADMIN">;
  staffRole: import("@/lib/domain/staff-permissions").StoreStaffRole;
  permissions: import("@/lib/domain/staff-permissions").StorePermission[];
  active: boolean;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_INVITE";
  lastLoginAt: IsoDateTime | null;
  invitationId: Uuid | null;
};

export type StaffInvitation = {
  id: Uuid;
  businessId: Uuid;
  email: string;
  phone: string | null;
  fullName: string;
  staffRole: import("@/lib/domain/staff-permissions").StoreStaffRole;
  permissions: import("@/lib/domain/staff-permissions").StorePermission[];
  tokenHash: string;
  expiresAt: IsoDateTime;
  acceptedAt: IsoDateTime | null;
  revokedAt: IsoDateTime | null;
  invitedByUserId: Uuid;
  createdAt: IsoDateTime;
};

export type DomainMapping = {
  id: Uuid;
  businessId: Uuid;
  host: string | null;
  pathSlug: string;
  status: "PENDING" | "ACTIVE" | "DISABLED";
  isPrimary: boolean;
};

export type Business = {
  id: Uuid;
  name: string;
  slug: string;
  shortName: string | null;
  logoUrl: string | null;
  logoMarkUrl: string | null;
  faviconUrl: string | null;
  coverUrl: string | null;
  /** Partner custom booking hero (desktop). Rendered only with booking.customHero entitlement. */
  bookingHeroImageUrl: string | null;
  /** Partner custom booking hero (mobile). Rendered only with booking.customHero entitlement. */
  bookingMobileHeroImageUrl: string | null;
  /** Custom booking tagline. Rendered only with booking.customTheme entitlement. */
  bookingTagline: string | null;
  /** Safe layout preset id (e.g. standard-6-card). Requires booking.customLayout. */
  bookingLayoutPreset: string | null;
  /** Safe visual theme preset id. Requires booking.customTheme. */
  bookingThemePreset: string | null;
  description: string | null;
  phone: string | null;
  lineUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  email: string | null;
  regionId: Uuid | null;
  provinceId: Uuid | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  currency: string;
  status: BusinessStatus;
  verifiedAt: IsoDateTime | null;
  averageRating: number | null;
  reviewCount: number;
  rankingScore: number;
  featured: boolean;
  sponsored: boolean;
  /** Extensible partner capability tags — not every store is chauffeur-only. */
  partnerServiceTypes: import("./partner-types").PartnerServiceType[];
  /** QUOTE_FIRST = current POND model; INSTANT_PRICE reserved for future. */
  commercialModel: "QUOTE_FIRST" | "INSTANT_PRICE";
  subscriptionPlan: string | null;
  isSeed: boolean;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  textColor: string | null;
  backgroundColor: string | null;
  customerSupportText: string | null;
  poweredByKubHaiEnabled: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Profile = {
  id: Uuid;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  passwordHash?: string;
};

export type BusinessUser = {
  id: Uuid;
  businessId: Uuid;
  userId: Uuid;
  role: Extract<Role, "BUSINESS_OWNER" | "BUSINESS_STAFF">;
  staffRole: import("@/lib/domain/staff-permissions").StoreStaffRole;
  permissions: import("@/lib/domain/staff-permissions").StorePermission[];
  phone: string | null;
  lastLoginAt: IsoDateTime | null;
  active: boolean;
};

export type SaasSubscriptionStatus =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELLED";

export type SaasInvoiceStatus =
  | "PENDING"
  | "AWAITING_REVIEW"
  | "PAID"
  | "REJECTED"
  | "OVERDUE"
  | "CANCELLED";

export type SaasSubscription = {
  id: Uuid;
  businessId: Uuid;
  planId: "starter" | "pro" | "business";
  status: SaasSubscriptionStatus;
  currentPeriodStart: IsoDateTime | null;
  currentPeriodEnd: IsoDateTime | null;
  nextDueAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type SaasBillingPeriod = {
  id: Uuid;
  businessId: Uuid;
  subscriptionId: Uuid;
  planIdSnapshot: "starter" | "pro" | "business";
  planNameSnapshot: string;
  amountThb: number;
  currency: "THB";
  periodStart: IsoDateTime;
  periodEnd: IsoDateTime;
  dueAt: IsoDateTime;
  status: SaasInvoiceStatus;
  createdAt: IsoDateTime;
  paidAt: IsoDateTime | null;
};

export type SaasPaymentProofStatus =
  | "AWAITING_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type SaasPaymentProof = {
  id: Uuid;
  businessId: Uuid;
  billingPeriodId: Uuid;
  expectedAmountThb: number;
  submittedAmountThb: number;
  originalFileName: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
  imageDataUrl: string;
  submittedAt: IsoDateTime;
  submittedByUserId: Uuid;
  status: SaasPaymentProofStatus;
  reviewedAt: IsoDateTime | null;
  reviewedByUserId: Uuid | null;
  rejectionReason: string | null;
  providerVerificationResult: Record<string, unknown> | null;
  duplicateOfProofId: Uuid | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type SaasPayment = {
  id: Uuid;
  businessId: Uuid;
  subscriptionId: Uuid;
  billingPeriodId: Uuid;
  paymentProofId: Uuid;
  amountThb: number;
  currency: "THB";
  reference: string;
  paidAt: IsoDateTime;
  approvedByUserId: Uuid;
  createdAt: IsoDateTime;
};

export type MerchantProvisioning = {
  idempotencyKey: string;
  ownerUserId: Uuid;
  businessId: Uuid;
  subscriptionId: Uuid;
  createdAt: IsoDateTime;
};

export type Vehicle = {
  id: Uuid;
  businessId: Uuid;
  ownershipType: OwnershipType;
  vehicleType: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  plateNumber: string | null;
  seats: number;
  luggageCapacity: number;
  description: string | null;
  amenities: string[];
  basePrice: number | null;
  pricingUnit: string | null;
  imageUrls: string[];
  /** Prefer over imageUrls[0] when set */
  coverImageUrl: string | null;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  active: boolean;
  isSeed: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Driver = {
  id: Uuid;
  businessId: Uuid;
  driverType: DriverType;
  name: string;
  nickname: string | null;
  phone: string | null;
  lineId: string | null;
  photoUrl: string | null;
  licenseNumber: string | null;
  status: "ACTIVE" | "INACTIVE";
  active: boolean;
  isSeed: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Customer = {
  id: Uuid;
  businessId: Uuid;
  customerType: CustomerType;
  name: string;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  taxId: string | null;
  branchType: "HQ" | "BRANCH" | null;
  branchNumber: string | null;
  taxInvoiceAddress: string | null;
  invoiceEmail: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type BookingItineraryItem = {
  id: Uuid;
  bookingId: Uuid;
  businessId: Uuid;
  placeId: Uuid | null;
  title: string;
  location: string | null;
  dayNumber: number | null;
  estimatedMinutes: number | null;
  note: string | null;
  sortOrder: number;
  /** START | STOP | END_OF_DAY | FINAL | UNDECIDED | STORE_HELP — optional for legacy rows */
  kind: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  source: string | null;
};

export type BookingNote = {
  id: Uuid;
  bookingId: Uuid;
  businessId: Uuid;
  authorUserId: Uuid | null;
  body: string;
  /** INTERNAL = staff only; CUSTOMER = visible on customer booking / quotation context. */
  audience: "INTERNAL" | "CUSTOMER";
  title: string | null;
  createdAt: IsoDateTime;
};

export type Booking = {
  id: Uuid;
  businessId: Uuid;
  bookingCode: string;
  securePublicToken: string;
  clientRequestId: string;
  /** Optional origin product; booking remains durable if the package is later unpublished. */
  tripPackageId: Uuid | null;
  customerId: Uuid | null;
  /** Platform CustomerAccount ownership — separate from per-store CRM Customer. */
  customerAccountId: Uuid | null;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  customerEmailSnapshot: string | null;
  customerType: CustomerType;
  companyName: string | null;
  taxId: string | null;
  serviceType: ServiceType;
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  passengerCount: number;
  luggageCount: number | null;
  pickupLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress: string | null;
  pickupPlaceId: string | null;
  pickupNote: string | null;
  pickupSource: string | null;
  dropoffLocation: string | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  dropoffAddress: string | null;
  dropoffPlaceId: string | null;
  dropoffNote: string | null;
  dropoffSource: string | null;
  tripNotes: string | null;
  letStorePlanTrip: boolean;
  preferredVehicleId: Uuid | null;
  assignedVehicleId: Uuid | null;
  assignedDriverId: Uuid | null;
  status: BookingStatus;
  quotedTotal: number | null;
  depositAmount: number | null;
  paidAmount: number;
  balanceAmount: number | null;
  driverFeeAmount: number | null;
  receivingAccountId: Uuid | null;
  acceptedQuotationId: Uuid | null;
  source: BookingSource;
  /** Operational trip times (not financial). */
  actualStartAt: IsoDateTime | null;
  /** Denormalized from trip check-in — expected locations remain unchanged. */
  pickupCheckedInAt: IsoDateTime | null;
  dropoffCheckedInAt: IsoDateTime | null;
  actualEndAt: IsoDateTime | null;
  scheduledEndAtSnapshot: IsoDateTime | null;
  earlyCompletionReason: string | null;
  earlyCompletionNote: string | null;
  completedByUserId: Uuid | null;
  completedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type QuotationItem = {
  id: Uuid;
  businessId: Uuid;
  quotationId: Uuid;
  type: QuotationItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
  note: string | null;
};

export type Quotation = {
  id: Uuid;
  businessId: Uuid;
  bookingId: Uuid;
  quotationNumber: string;
  version: number;
  status: QuotationStatus;
  currency: "THB";
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  depositType: QuotationDepositType;
  depositValue: number;
  depositRequiredAmount: number;
  balanceAmount: number;
  note: string | null;
  terms: string | null;
  /** Quotation term only — does not create MoneyMovement / customer debt. */
  includedHoursPerDay: number | null;
  /** Quotation term only — does not create MoneyMovement / customer debt. */
  overtimeRatePerHour: number | null;
  validUntil: IsoDateTime | null;
  sentAt: IsoDateTime | null;
  acceptedAt: IsoDateTime | null;
  rejectedAt: IsoDateTime | null;
  changeRequestText: string | null;
  changeRequestedAt: IsoDateTime | null;
  rejectReason: string | null;
  createdBy: Uuid | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type RecommendedPeriod = "DAY" | "EVENING" | "NIGHT";

/** PLACE = specific venue; GUIDE/AREA/COLLECTION/INSPIRATION = editorial concepts (not fake businesses). */
export type PlaceKind = "PLACE" | "GUIDE" | "AREA" | "COLLECTION" | "INSPIRATION";

export type PlaceSourceType = "PLATFORM" | "AGENT";
export type PlacePlatformModerationStatus =
  | "NOT_SUBMITTED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type Place = {
  id: Uuid;
  /** null = KubHai platform / editorial place (not owned by a transport store) */
  businessId: Uuid | null;
  sourceType: PlaceSourceType;
  platformModerationStatus: PlacePlatformModerationStatus;
  platformSubmittedAt: IsoDateTime | null;
  platformReviewedAt: IsoDateTime | null;
  platformReviewedByUserId: Uuid | null;
  platformRejectionReason: string | null;
  provinceId: Uuid;
  category: PlaceCategory;
  subcategory: string | null;
  /** Distinguishes real venues from area/guide editorial cards. */
  placeKind: PlaceKind;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  imageUrls: string[];
  /** Prefer over imageUrls[0] when set — never a fleet vehicle URL */
  coverImageUrl: string | null;
  address: string | null;
  district: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Google Places id when selected via Maps — optional; null for manual */
  googlePlaceId: string | null;
  openingHours: string | null;
  priceLevel: string | null;
  estimatedDurationMinutes: number | null;
  entranceFee: string | null;
  tags: string[];
  /** Editorial visit periods — NOT opening hours */
  recommendedPeriods: RecommendedPeriod[];
  localRecommended: boolean;
  featured: boolean;
  sponsored: boolean;
  sponsorBusinessName: string | null;
  sponsorLabel: string | null;
  status: "ACTIVE" | "HIDDEN";
  sortOrder: number;
  isSeed: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type AnalyticsEvent = {
  id: Uuid;
  businessId: Uuid | null;
  sessionId: string;
  customerId: Uuid | null;
  bookingId: Uuid | null;
  eventName: AnalyticEventName;
  eventData: Record<string, unknown>;
  source: BookingSource | null;
  referrer: string | null;
  createdAt: IsoDateTime;
};

export type MoneyDirection = "IN" | "OUT";

export type MoneyAllocationKind =
  | "DEPOSIT"
  | "SERVICE_BALANCE"
  | "TIP_RECEIVED"
  | "DRIVER_PAYOUT"
  | "TIP_PAYOUT"
  | "PARTNER_PAYOUT"
  | "ADJUSTMENT";

export type MoneyPayeeKind = "DRIVER" | "PARTNER" | "TEAM";

export type MoneyAllocation = {
  kind: MoneyAllocationKind;
  amount: number;
};

export type MoneyMovement = {
  id: Uuid;
  businessId: Uuid;
  bookingId: Uuid;
  direction: MoneyDirection;
  transferAmount: number;
  allocations: MoneyAllocation[];
  method: string | null;
  reference: string | null;
  note: string | null;
  occurredAt: IsoDateTime;
  payeeKind: MoneyPayeeKind | null;
  payeeId: Uuid | null;
  payeeName: string | null;
  actorUserId: Uuid | null;
  paymentProofId: Uuid | null;
  receivingAccountId: Uuid | null;
  receivingAccountSnapshot: PaymentAccountSnapshot | null;
  sourceAccountId: Uuid | null;
  sourceAccountSnapshot: PaymentAccountSnapshot | null;
  legacyAccountUnknown: boolean;
  createdAt: IsoDateTime;
};

export type PaymentAccountType = "BANK_ACCOUNT" | "PROMPTPAY" | "OTHER";

export type PaymentAccount = {
  id: Uuid;
  businessId: Uuid;
  displayName: string;
  accountType: PaymentAccountType;
  bankCode: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  promptPayId: string | null;
  qrImagePath: string | null;
  qrDisplayEnabled: boolean;
  isDefault: boolean;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type PaymentAccountSnapshot = {
  id: Uuid;
  displayName: string;
  accountType: PaymentAccountType;
  bankCode: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  accountNumberMasked: string | null;
  promptPayId: string | null;
};

export type PaymentProofIntent =
  | "DEPOSIT"
  | "SERVICE_BALANCE"
  | "TIP_RECEIVED"
  | "COMBINED_BALANCE_AND_TIP";

export type PaymentProofReviewStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type PaymentProofSubmitter = "CUSTOMER" | "STORE_ADMIN";

export type SlipFile = {
  id: Uuid;
  businessId: Uuid;
  bookingId: Uuid;
  mime: string;
  ext: string;
  originalName: string | null;
  createdAt: IsoDateTime;
};

export type PaymentProof = {
  id: Uuid;
  businessId: Uuid;
  bookingId: Uuid;
  paymentIntent: PaymentProofIntent;
  claimedAmount: number;
  receivingAccountId: Uuid | null;
  receivingAccountSnapshot: PaymentAccountSnapshot | null;
  slipFileId: Uuid;
  submittedAt: IsoDateTime;
  submittedBy: PaymentProofSubmitter;
  submittedByUserId: Uuid | null;
  reviewStatus: PaymentProofReviewStatus;
  reviewedBy: Uuid | null;
  reviewedAt: IsoDateTime | null;
  rejectReason: string | null;
  adminNote: string | null;
  allocations: MoneyAllocation[];
  moneyMovementId: Uuid | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type AuditLog = {
  id: Uuid;
  businessId: Uuid | null;
  actorUserId: Uuid | null;
  action: string;
  entityType: string;
  entityId: Uuid | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTime;
};

export type Actor =
  | { kind: "public"; sessionId: string }
  | {
      kind: "user";
      userId: Uuid;
      role: Role;
      businessIds: Uuid[];
    }
  | { kind: "booking_token"; token: string }
  | { kind: "customer"; customerAccountId: Uuid }
  | { kind: "driver_job"; token: string; jobLinkId: Uuid };

/** Secure per-assignment driver access (no driver login). */
export type DriverJobLink = {
  id: Uuid;
  businessId: Uuid;
  bookingId: Uuid;
  driverId: Uuid;
  vehicleId: Uuid | null;
  secureToken: string;
  status: "ACTIVE" | "REVOKED";
  issuedAt: IsoDateTime;
  revokedAt: IsoDateTime | null;
  firstOpenedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

/** Day-by-day operational work log — no pause/resume. */
export type DriverDayWorkLog = {
  id: Uuid;
  businessId: Uuid;
  bookingId: Uuid;
  driverJobLinkId: Uuid;
  driverId: Uuid;
  dayNumber: number;
  dayDate: string;
  startedAt: IsoDateTime | null;
  endedAt: IsoDateTime | null;
  elapsedMinutes: number | null;
  startedBy: "DRIVER" | "ADMIN_OVERRIDE";
  endedBy: "DRIVER" | "ADMIN_OVERRIDE" | null;
  overrideReason: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

/** Driver suggestion — does NOT mutate itinerary. */
export type DriverRouteSuggestion = {
  id: Uuid;
  businessId: Uuid;
  bookingId: Uuid;
  driverJobLinkId: Uuid;
  driverId: Uuid;
  dayNumber: number | null;
  body: string;
  status: "OPEN" | "ACKNOWLEDGED";
  createdAt: IsoDateTime;
};

export type NotificationRead = {
  id: Uuid;
  businessId: Uuid;
  notificationId: string;
  readAt: IsoDateTime;
  userId: Uuid | null;
};

export type BookingRequestInput = {
  businessSlug: string;
  clientRequestId: string;
  tripPackageId?: string | null;
  serviceType: ServiceType;
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  passengerCount: number;
  luggageCount: number | null;
  pickupLocation: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupAddress?: string | null;
  pickupPlaceId?: string | null;
  pickupNote?: string | null;
  pickupSource?: string | null;
  dropoffLocation: string | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffAddress?: string | null;
  dropoffPlaceId?: string | null;
  dropoffNote?: string | null;
  dropoffSource?: string | null;
  tripNotes: string | null;
  letStorePlanTrip: boolean;
  preferredVehicleId: string | null;
  placeIds: string[];
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerType: CustomerType;
  companyName: string | null;
  taxId: string | null;
  source: BookingSource;
  sessionId: string;
  referrer: string | null;
  /** Day-by-day itinerary (multi-day). Empty for simple services. */
  itineraryDays?: Array<{
    dayNumber: number;
    sortOrder: number;
    kind: string;
    title: string;
    location: string | null;
    placeId: string | null;
    note: string | null;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    source: string | null;
  }>;
  storeHelpInterests?: string[];
};

export type StoreInboxCounts = {
  REQUESTED: number;
  CHECKING_AVAILABILITY: number;
  AVAILABLE: number;
  QUOTATION_SENT: number;
  CUSTOMER_CONFIRMED: number;
  WAITING_DEPOSIT: number;
  CONFIRMED: number;
  IN_PROGRESS: number;
  todayJobs: number;
  unassignedVehicle: number;
  unassignedDriver: number;
  COMPLETED: number;
  CANCELLED: number;
};

export type {
  LocalizedOptionalText,
  LocalizedStringList,
  LocalizedText,
  TripPackage,
  TripPackageDay,
  TripPackageListFilter,
  TripPackagePricingMode,
  TripPackageStatus,
  TripPackageStop,
  TripPackageUpdateInput,
  TripPackageWriteInput,
} from "./trip-package";
