export const ROLES = [
  "SUPER_ADMIN",
  "BUSINESS_OWNER",
  "BUSINESS_STAFF",
  "CUSTOMER",
] as const;
export type Role = (typeof ROLES)[number];

export const BUSINESS_STATUSES = ["DRAFT", "ACTIVE", "SUSPENDED"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const OWNERSHIP_TYPES = ["OWN", "PARTNER"] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const DRIVER_TYPES = ["INTERNAL", "PARTNER"] as const;
export type DriverType = (typeof DRIVER_TYPES)[number];

export const SERVICE_TYPES = [
  "PRIVATE_DRIVER_DAILY",
  "AIRPORT_TRANSFER",
  "POINT_TO_POINT",
  "CUSTOM_TRIP",
  "MULTI_DAY_TRIP",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const BOOKING_STATUSES = [
  "REQUESTED",
  "CHECKING_AVAILABILITY",
  "AVAILABLE",
  "QUOTATION_SENT",
  "CUSTOMER_CONFIRMED",
  "WAITING_DEPOSIT",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const CUSTOMER_TYPES = ["PERSONAL", "COMPANY"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const QUOTATION_STATUSES = [
  "DRAFT",
  "SENT",
  "CUSTOMER_ACCEPTED",
  "CUSTOMER_CHANGE_REQUESTED",
  "CUSTOMER_REJECTED",
  "EXPIRED",
  "SUPERSEDED",
  "CANCELLED",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_ITEM_TYPES = [
  "VEHICLE_SERVICE",
  "DRIVER_SERVICE",
  "OVERTIME",
  "PICKUP_DROPOFF",
  "FOOD",
  "TICKET",
  "ACTIVITY",
  "ACCOMMODATION",
  "TOLL",
  "PARKING",
  "CUSTOM",
  "DISCOUNT",
] as const;
export type QuotationItemType = (typeof QUOTATION_ITEM_TYPES)[number];

export const QUOTATION_DEPOSIT_TYPES = ["FIXED_AMOUNT", "PERCENTAGE", "NONE"] as const;
export type QuotationDepositType = (typeof QUOTATION_DEPOSIT_TYPES)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "SLIP_UPLOADED",
  "APPROVED",
  "REJECTED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PLACE_CATEGORIES = [
  "ATTRACTION",
  "RESTAURANT",
  "LOCAL_FOOD",
  "CAFE",
  "HOTEL",
  "RELAXATION",
  "SPA",
  "SHOPPING",
  "SOUVENIR",
  "ACTIVITY",
  "OTHER",
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const BOOKING_SOURCES = [
  "FACEBOOK",
  "LINE",
  "WEBSITE",
  "DIRECT",
  "GOOGLE",
  "TIKTOK",
  "OTHER",
] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const ANALYTIC_EVENTS = [
  "store_view",
  "booking_started",
  "date_selected",
  "vehicle_viewed",
  "vehicle_selected",
  "place_viewed",
  "place_added_to_trip",
  "booking_submitted",
  "quotation_viewed",
  "quotation_accepted",
  "quotation_rejected",
  "payment_page_viewed",
  "slip_uploaded",
  "booking_confirmed",
  "booking_cancelled",
  "booking_completed",
] as const;
export type AnalyticEventName = (typeof ANALYTIC_EVENTS)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  PRIVATE_DRIVER_DAILY: "รถพร้อมคนขับรายวัน",
  AIRPORT_TRANSFER: "รับ-ส่งสนามบิน",
  POINT_TO_POINT: "รับส่งจุดต่อจุด",
  CUSTOM_TRIP: "จัดทริป",
  MULTI_DAY_TRIP: "จัดทริป / หลายวัน",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  REQUESTED: "คำขอใหม่",
  CHECKING_AVAILABILITY: "รอตรวจสอบรถ",
  AVAILABLE: "มีรถว่าง",
  QUOTATION_SENT: "รอเสนอราคา / ส่งราคาแล้ว",
  CUSTOMER_CONFIRMED: "ลูกค้ายืนยันแล้ว",
  WAITING_DEPOSIT: "รอมัดจำ",
  CONFIRMED: "ยืนยันแล้ว",
  IN_PROGRESS: "กำลังเดินทาง",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
  REJECTED: "ปฏิเสธ",
};

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  ATTRACTION: "ที่เที่ยวยอดนิยม",
  RESTAURANT: "ร้านอาหารดัง",
  LOCAL_FOOD: "ร้านอาหารรสเด็ดคนพื้นที่แนะนำ",
  CAFE: "คาเฟ่",
  HOTEL: "ที่พัก",
  RELAXATION: "พักผ่อน",
  SPA: "สปา",
  SHOPPING: "ช้อปปิ้ง",
  SOUVENIR: "ของฝาก",
  ACTIVITY: "กิจกรรม",
  OTHER: "อื่นๆ",
};
