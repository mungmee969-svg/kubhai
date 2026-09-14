import type { BookingStatus } from "@/lib/domain/enums";
import type {
  Actor,
  AnalyticsEvent,
  AuditLog,
  Booking,
  BookingItineraryItem,
  BookingNote,
  MoneyMovement,
  PaymentAccount,
  PaymentProof,
  PaymentProofIntent,
  PaymentProofReviewStatus,
  Quotation,
  QuotationItem,
  SlipFile,
  BookingRequestInput,
  Business,
  BusinessSettings,
  Customer,
  Driver,
  Place,
  Profile,
  Province,
  Region,
  StaffMember,
  StoreInboxCounts,
  TripPackage,
  TripPackageListFilter,
  TripPackageStatus,
  TripPackageUpdateInput,
  TripPackageWriteInput,
  Vehicle,
} from "@/lib/domain/types";
import type { OwnershipType, DriverType } from "@/lib/domain/enums";

export class TenantIsolationError extends Error {
  constructor(message = "ไม่มีสิทธิ์เข้าถึงข้อมูลร้านนี้") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export type PublicStore = {
  business: Business;
  settings: BusinessSettings | null;
  vehicles: Vehicle[];
  places: Place[];
  region: Region | null;
  province: Province | null;
};

export type BookingRecord = {
  booking: Booking;
  itinerary: BookingItineraryItem[];
  vehicle: Vehicle | null;
  preferredVehicle: Vehicle | null;
  driver: Driver | null;
  business: Business;
  customer: Customer | null;
  notes: BookingNote[];
  movements: MoneyMovement[];
  proofs: PaymentProof[];
  receivingAccount: PaymentAccount | null;
  quotations: (Quotation & { items: QuotationItem[] })[];
  auditLogs: AuditLog[];
  tripCheckIns: import("@/lib/domain/location").TripCheckIn[];
};

export type DriverJobRecord = {
  link: import("@/lib/domain/types").DriverJobLink;
  booking: Booking;
  business: Business;
  vehicle: Vehicle | null;
  driver: Driver | null;
  itinerary: BookingItineraryItem[];
  dayLogs: import("@/lib/domain/types").DriverDayWorkLog[];
  suggestions: import("@/lib/domain/types").DriverRouteSuggestion[];
  notes: BookingNote[];
  brand: {
    name: string;
    shortName: string | null;
    logoUrl: string | null;
    logoMarkUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
    phone: string | null;
    customerSupportText: string | null;
  };
};

export type DriverJobAdminSummary = {
  link: import("@/lib/domain/types").DriverJobLink | null;
  dayLogs: import("@/lib/domain/types").DriverDayWorkLog[];
};

export type QuotationRecord = Quotation & { items: QuotationItem[] };

export type QuotationDraftInput = {
  items: {
    id?: string;
    type: QuotationItem["type"];
    description: string;
    quantity: number;
    unitPrice: number;
    note?: string | null;
  }[];
  discountAmount?: number;
  depositType: Quotation["depositType"];
  depositValue?: number;
  note?: string | null;
  terms?: string | null;
  /** OT terms — informational only; never auto-creates money movements. */
  includedHoursPerDay?: number | null;
  overtimeRatePerHour?: number | null;
  validUntil?: string | null;
};

export type MoneyMovementInput = {
  direction: MoneyMovement["direction"];
  transferAmount: number;
  allocations: MoneyMovement["allocations"];
  method?: string | null;
  reference?: string | null;
  note?: string | null;
  occurredAt?: string;
  payeeKind?: MoneyMovement["payeeKind"];
  payeeId?: string | null;
  payeeName?: string | null;
  paymentProofId?: string | null;
  receivingAccountId?: string | null;
  sourceAccountId?: string | null;
};

export type PaymentAccountInput = {
  id?: string;
  displayName: string;
  accountType: PaymentAccount["accountType"];
  bankCode?: string | null;
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  promptPayId?: string | null;
  qrImagePath?: string | null;
  qrDisplayEnabled?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
};

export type PaymentProofSubmitInput = {
  bookingId: string;
  paymentIntent: PaymentProofIntent;
  claimedAmount: number;
  allocations: MoneyMovement["allocations"];
  slipFileId: string;
  receivingAccountId?: string | null;
  submittedBy?: PaymentProof["submittedBy"];
};

export type ApproveProofResult = {
  proof: PaymentProof;
  movement: MoneyMovement | null;
  reused: boolean;
};

export type BookingFinancePlan = {
  quotedTotal?: number | null;
  depositAmount?: number | null;
  driverFeeAmount?: number | null;
};

export type VehicleInput = {
  id?: string;
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
  coverImageUrl?: string | null;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  active: boolean;
};

export type DriverInput = {
  id?: string;
  driverType: DriverType;
  name: string;
  nickname: string | null;
  phone: string | null;
  lineId: string | null;
  photoUrl: string | null;
  licenseNumber: string | null;
  status: "ACTIVE" | "INACTIVE";
  active: boolean;
};

export type TripPatch = {
  startDate?: string;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  pickupLocation?: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupAddress?: string | null;
  pickupPlaceId?: string | null;
  pickupNote?: string | null;
  pickupSource?: string | null;
  dropoffLocation?: string | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffAddress?: string | null;
  dropoffPlaceId?: string | null;
  dropoffNote?: string | null;
  dropoffSource?: string | null;
  passengerCount?: number;
  luggageCount?: number | null;
  tripNotes?: string | null;
  serviceType?: Booking["serviceType"];
  locationChangeReason?: string | null;
};

export type PlaceInput = {
  id?: string;
  category: Place["category"];
  name: string;
  shortDescription?: string | null;
  description: string | null;
  address: string | null;
  area?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googlePlaceId?: string | null;
  imageUrls: string[];
  coverImageUrl?: string | null;
  localRecommended: boolean;
  estimatedDurationMinutes: number | null;
  status: "ACTIVE" | "HIDDEN";
};

export type TenantBoard = {
  business: Business;
  settings: BusinessSettings | null;
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
  customers: Customer[];
  places: Place[];
  staff: StaffMember[];
};

export type AssignmentPreview = {
  hardVehicle: Booking | null;
  hardDriver: Booking | null;
  warnVehicle: Booking | null;
  warnDriver: Booking | null;
};

export type Store = {
  getPublicStore(slug: string): Promise<PublicStore | null>;
  listPublicPlaces(opts?: {
    provinceSlug?: string | null;
    category?: string | null;
  }): Promise<Place[]>;
  getPublicPlaceBySlug(slug: string): Promise<{
    place: Place;
    province: { id: string; nameTh: string; slug: string } | null;
  } | null>;
  getVehicle(businessId: string, vehicleId: string): Promise<Vehicle | null>;
  listVehicles(actor: Actor, businessId: string): Promise<Vehicle[]>;
  upsertVehicle(actor: Actor, businessId: string, input: VehicleInput): Promise<Vehicle>;
  setVehicleActive(actor: Actor, vehicleId: string, active: boolean): Promise<Vehicle>;
  listDrivers(actor: Actor, businessId: string): Promise<Driver[]>;
  upsertDriver(actor: Actor, businessId: string, input: DriverInput): Promise<Driver>;
  setDriverActive(actor: Actor, driverId: string, active: boolean): Promise<Driver>;
  listCustomers(actor: Actor, businessId: string): Promise<Customer[]>;
  getCustomer(actor: Actor, customerId: string): Promise<Customer | null>;
  listPlaces(actor: Actor, businessId: string): Promise<Place[]>;
  updateBusinessProfile(
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
  ): Promise<Business>;
  updateSettings(
    actor: Actor,
    businessId: string,
    patch: Partial<Pick<BusinessSettings, "faq" | "tips" | "bookingNotes" | "defaultDepositPercent" | "ops">>,
  ): Promise<BusinessSettings>;
  upsertPlace(actor: Actor, businessId: string, input: PlaceInput): Promise<Place>;
  setPlaceActive(actor: Actor, placeId: string, active: boolean): Promise<Place>;
  archivePlace(actor: Actor, placeId: string): Promise<Place>;
  listTripPackages(
    actor: Actor,
    businessId: string,
    filter?: TripPackageListFilter,
  ): Promise<TripPackage[]>;
  listPublicTripPackages(businessId: string): Promise<TripPackage[]>;
  getTripPackage(actor: Actor, id: string): Promise<TripPackage | null>;
  getPublicTripPackage(businessId: string, id: string): Promise<TripPackage | null>;
  createTripPackage(
    actor: Actor,
    businessId: string,
    input: TripPackageWriteInput,
  ): Promise<TripPackage>;
  updateTripPackage(
    actor: Actor,
    id: string,
    input: TripPackageUpdateInput,
  ): Promise<TripPackage>;
  setTripPackageStatus(
    actor: Actor,
    id: string,
    status: TripPackageStatus,
  ): Promise<TripPackage>;
  publishTripPackage(actor: Actor, id: string): Promise<TripPackage>;
  unpublishTripPackage(actor: Actor, id: string): Promise<TripPackage>;
  archiveTripPackage(actor: Actor, id: string): Promise<TripPackage>;
  loadTenantBoard(actor: Actor, businessId: string): Promise<TenantBoard>;
  searchOps(
    actor: Actor,
    businessId: string,
    query: string,
  ): Promise<{
    bookings: Booking[];
    customers: Customer[];
    vehicles: Vehicle[];
    drivers: Driver[];
  }>;
  updateBookingTrip(actor: Actor, bookingId: string, patch: TripPatch): Promise<Booking>;
  addBookingNote(
    actor: Actor,
    bookingId: string,
    body: string,
    options?: { audience?: "INTERNAL" | "CUSTOMER"; title?: string | null },
  ): Promise<BookingNote>;
  listMoneyMovements(actor: Actor, businessId: string, bookingId?: string): Promise<MoneyMovement[]>;
  recordMoneyMovement(actor: Actor, bookingId: string, input: MoneyMovementInput): Promise<MoneyMovement>;
  updateBookingFinancePlan(actor: Actor, bookingId: string, patch: BookingFinancePlan): Promise<Booking>;
  listPaymentAccounts(
    actor: Actor,
    businessId: string,
    opts?: { includeInactive?: boolean },
  ): Promise<PaymentAccount[]>;
  upsertPaymentAccount(actor: Actor, businessId: string, input: PaymentAccountInput): Promise<PaymentAccount>;
  setDefaultPaymentAccount(actor: Actor, accountId: string): Promise<PaymentAccount>;
  setPaymentAccountActive(actor: Actor, accountId: string, active: boolean): Promise<PaymentAccount>;
  setBookingReceivingAccount(actor: Actor, bookingId: string, accountId: string): Promise<Booking>;
  listPaymentProofs(
    actor: Actor,
    businessId: string,
    filter?: { bookingId?: string; reviewStatus?: PaymentProofReviewStatus },
  ): Promise<PaymentProof[]>;
  getPaymentProof(actor: Actor, proofId: string): Promise<PaymentProof | null>;
  writeSlipFile(
    actor: Actor,
    input: { bookingId: string; bytes: Uint8Array; mime: string; originalName?: string | null },
  ): Promise<SlipFile>;
  readSlipFile(actor: Actor, fileId: string): Promise<{ file: SlipFile; bytes: Uint8Array; mime: string }>;
  readSlipFileByToken(
    token: string,
    fileId: string,
  ): Promise<{ file: SlipFile; bytes: Uint8Array; mime: string } | null>;
  submitPaymentProof(actor: Actor, input: PaymentProofSubmitInput): Promise<PaymentProof>;
  updatePaymentProofAllocation(
    actor: Actor,
    proofId: string,
    allocations: MoneyMovement["allocations"],
  ): Promise<PaymentProof>;
  approvePaymentProof(
    actor: Actor,
    proofId: string,
    input?: { allocations?: MoneyMovement["allocations"]; adminNote?: string | null },
  ): Promise<ApproveProofResult>;
  rejectPaymentProof(
    actor: Actor,
    proofId: string,
    input: { reason: string; adminNote?: string | null },
  ): Promise<PaymentProof>;
  upsertItineraryItem(
    actor: Actor,
    bookingId: string,
    input: Partial<BookingItineraryItem> & { title: string },
  ): Promise<BookingItineraryItem>;
  deleteItineraryItem(actor: Actor, itemId: string): Promise<void>;
  previewAssignment(
    actor: Actor,
    bookingId: string,
    input: { vehicleId?: string | null; driverId?: string | null },
  ): Promise<AssignmentPreview>;
  createBookingRequest(
    input: BookingRequestInput,
  ): Promise<{ booking: Booking; reused: boolean }>;
  getBookingByToken(token: string): Promise<BookingRecord | null>;
  getBookingById(actor: Actor, bookingId: string): Promise<BookingRecord | null>;
  listBookings(
    actor: Actor,
    businessId: string,
    filter?: { status?: BookingStatus | "TODAY" | "NO_VEHICLE" | "NO_DRIVER" },
  ): Promise<Booking[]>;
  inboxCounts(actor: Actor, businessId: string): Promise<StoreInboxCounts>;
  updateBookingStatus(
    actor: Actor,
    bookingId: string,
    status: BookingStatus,
    opts?: { reason?: string | null },
  ): Promise<Booking>;
  completeBooking(
    actor: Actor,
    bookingId: string,
    input?: {
      earlyCompletionReason?: string | null;
      earlyCompletionNote?: string | null;
      now?: string | null;
      acknowledgeOutstanding?: boolean;
    },
  ): Promise<Booking>;
  assignBooking(
    actor: Actor,
    bookingId: string,
    input: { vehicleId?: string | null; driverId?: string | null },
  ): Promise<Booking>;
  getDriverJobByToken(token: string): Promise<DriverJobRecord | null>;
  openDriverJob(token: string): Promise<DriverJobRecord | null>;
  startDriverDay(token: string, dayNumber: number): Promise<DriverJobRecord>;
  endDriverDay(token: string, dayNumber: number): Promise<DriverJobRecord>;
  submitDriverSuggestion(
    token: string,
    input: { body: string; dayNumber?: number | null },
  ): Promise<import("@/lib/domain/types").DriverRouteSuggestion>;
  listDriverJobForBooking(actor: Actor, bookingId: string): Promise<DriverJobAdminSummary>;
  adminOverrideStartDay(
    actor: Actor,
    bookingId: string,
    dayNumber: number,
    reason?: string | null,
  ): Promise<import("@/lib/domain/types").DriverDayWorkLog>;
  adminOverrideEndDay(
    actor: Actor,
    bookingId: string,
    dayNumber: number,
    reason?: string | null,
  ): Promise<import("@/lib/domain/types").DriverDayWorkLog>;
  markNotificationRead(
    actor: Actor,
    businessId: string,
    notificationId: string,
  ): Promise<import("@/lib/domain/types").NotificationRead>;
  markAllNotificationsRead(
    actor: Actor,
    businessId: string,
    notificationIds: string[],
  ): Promise<import("@/lib/domain/types").NotificationRead[]>;
  listNotificationReads(
    actor: Actor,
    businessId: string,
  ): Promise<import("@/lib/domain/types").NotificationRead[]>;
  listDriverDayLogs(
    actor: Actor,
    businessId: string,
  ): Promise<import("@/lib/domain/types").DriverDayWorkLog[]>;
  listDriverJobLinks(
    actor: Actor,
    businessId: string,
  ): Promise<import("@/lib/domain/types").DriverJobLink[]>;
  listDriverRouteSuggestions(
    actor: Actor,
    businessId: string,
  ): Promise<import("@/lib/domain/types").DriverRouteSuggestion[]>;
  listBusinesses(actor: Actor): Promise<Business[]>;
  authenticate(
    email: string,
    password: string,
  ): Promise<{ profile: Profile; businessIds: string[] } | null>;
  trackEvent(
    event: Omit<AnalyticsEvent, "id" | "createdAt"> & { id?: string },
  ): Promise<void>;
  listAuditLogs(actor: Actor, businessId: string): Promise<AuditLog[]>;
  listQuotations(actor: Actor, businessId: string, bookingId?: string): Promise<QuotationRecord[]>;
  getQuotation(actor: Actor, quotationId: string): Promise<QuotationRecord | null>;
  createQuotationDraft(actor: Actor, bookingId: string): Promise<QuotationRecord>;
  updateQuotationDraft(actor: Actor, quotationId: string, input: QuotationDraftInput): Promise<QuotationRecord>;
  sendQuotation(actor: Actor, quotationId: string): Promise<QuotationRecord>;
  createQuotationRevision(actor: Actor, quotationId: string): Promise<QuotationRecord>;
  cancelQuotation(actor: Actor, quotationId: string): Promise<QuotationRecord>;
  acceptQuotation(actor: Actor, quotationId: string): Promise<QuotationRecord>;
  requestQuotationChange(actor: Actor, quotationId: string, text: string): Promise<QuotationRecord>;
  rejectQuotation(actor: Actor, quotationId: string, reason: string | null): Promise<QuotationRecord>;
  // Customer auth / portal (platform identity)
  getCustomerAccount(customerAccountId: string): Promise<import("@/lib/domain/customer-auth").CustomerAccount | null>;
  startCustomerSignup(phone: string): Promise<{
    challengeId: string;
    expiresAt: string;
    resendAvailableAt: string;
    devCode?: string;
  }>;
  completeCustomerSignup(input: {
    challengeId: string;
    code: string;
    password: string;
    displayName?: string | null;
  }): Promise<import("@/lib/domain/customer-auth").CustomerAccount>;
  loginCustomerWithPassword(
    phone: string,
    password: string,
  ): Promise<import("@/lib/domain/customer-auth").CustomerAccount | null>;
  startForgotPassword(phone: string): Promise<{
    challengeId: string;
    expiresAt: string;
    resendAvailableAt: string;
    devCode?: string;
  }>;
  completeForgotPassword(input: {
    challengeId: string;
    code: string;
    password: string;
  }): Promise<import("@/lib/domain/customer-auth").CustomerAccount>;
  beginSocialLogin(
    provider: "GOOGLE" | "FACEBOOK",
    returnTo: string,
  ): Promise<{ mode: "mock"; mockToken: string; returnTo: string }>;
  completeSocialLogin(input: {
    provider: "GOOGLE" | "FACEBOOK";
    mockToken?: string;
    subjectId?: string;
    email?: string;
    displayName?: string;
  }): Promise<import("@/lib/domain/customer-auth").CustomerAccount>;
  requestCustomerOtp(input: {
    phone: string;
    purpose: import("@/lib/auth/otp").OtpPurpose;
    customerAccountId?: string | null;
  }): Promise<{
    challengeId: string;
    expiresAt: string;
    resendAvailableAt: string;
    devCode?: string;
  }>;
  verifyCustomerOtp(input: {
    challengeId: string;
    code: string;
  }): Promise<
    | { ok: true; phoneNormalized: string; purpose: import("@/lib/auth/otp").OtpPurpose; customerAccountId: string | null }
    | { ok: false; reason: "EXPIRED" | "USED" | "INVALID" | "LOCKED" | "NOT_FOUND" }
  >;
  verifyPhoneForAccount(input: {
    customerAccountId: string;
    challengeId: string;
    code: string;
  }): Promise<import("@/lib/domain/customer-auth").CustomerAccount>;
  claimBookingByToken(customerAccountId: string, token: string): Promise<Booking>;
  listCustomerBookings(customerAccountId: string): Promise<Booking[]>;
  getCustomerBookingRecord(customerAccountId: string, bookingId: string): Promise<BookingRecord | null>;
  recordTripCheckIn(
    actor: Actor,
    bookingId: string,
    input: {
      kind: "PICKUP" | "DROPOFF";
      latitude: number;
      longitude: number;
      accuracyMeters?: number | null;
      overrideReason?: string | null;
      note?: string | null;
      now?: string | null;
    },
  ): Promise<import("@/lib/domain/location").TripCheckIn>;
  startTrip(actor: Actor, bookingId: string, input?: { now?: string | null }): Promise<Booking>;
  listTripCheckIns(actor: Actor, bookingId: string): Promise<import("@/lib/domain/location").TripCheckIn[]>;
  listStaff(actor: Actor, businessId: string): Promise<StaffMember[]>;
  inviteStaff(
    actor: Actor,
    businessId: string,
    input: {
      fullName: string;
      email: string;
      phone?: string | null;
      staffRole: import("@/lib/domain/staff-permissions").StoreStaffRole;
      permissions?: import("@/lib/domain/staff-permissions").StorePermission[] | null;
    },
  ): Promise<{
    invitation: import("@/lib/domain/types").StaffInvitation;
    inviteUrl: string;
    rawToken: string;
  }>;
  revokeStaffInvite(actor: Actor, businessId: string, invitationId: string): Promise<import("@/lib/domain/types").StaffInvitation>;
  getStaffInviteByToken(token: string): Promise<{
    invitation: import("@/lib/domain/types").StaffInvitation;
    business: Business;
  } | null>;
  acceptStaffInvite(input: {
    token: string;
    password: string;
    fullName?: string | null;
  }): Promise<{ profile: import("@/lib/domain/types").Profile; businessId: string }>;
  updateStaffMember(
    actor: Actor,
    businessId: string,
    membershipId: string,
    input: {
      staffRole?: import("@/lib/domain/staff-permissions").StoreStaffRole;
      permissions?: import("@/lib/domain/staff-permissions").StorePermission[] | null;
      active?: boolean;
    },
  ): Promise<import("@/lib/domain/types").BusinessUser>;
  removeStaffMember(actor: Actor, businessId: string, membershipId: string): Promise<import("@/lib/domain/types").BusinessUser>;
  assertActiveStoreMembership(userId: string, businessId: string): Promise<boolean>;
};
