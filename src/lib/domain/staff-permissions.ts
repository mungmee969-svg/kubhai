/**
 * Store staff roles + permissions.
 * Authorization is enforced server-side — UI hiding is not enough.
 */

export const STORE_STAFF_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
export type StoreStaffRole = (typeof STORE_STAFF_ROLES)[number];

export const STORE_PERMISSIONS = [
  "BOOKING_VIEW",
  "BOOKING_MANAGE",
  "DISPATCH_VIEW",
  "DISPATCH_MANAGE",
  "VEHICLE_VIEW",
  "VEHICLE_MANAGE",
  "DRIVER_VIEW",
  "DRIVER_MANAGE",
  "CUSTOMER_VIEW",
  "CUSTOMER_MANAGE",
  "PAYMENT_VIEW",
  "PAYMENT_PROOF_APPROVE",
  "FINANCE_VIEW",
  "FINANCE_MANAGE",
  "DRIVER_PAYOUT_MANAGE",
  "PARTNER_PAYOUT_MANAGE",
  "TIP_PAYOUT_MANAGE",
  "PAYMENT_ACCOUNT_MANAGE",
  "REPORT_VIEW",
  "STORE_SETTINGS_VIEW",
  "STORE_SETTINGS_MANAGE",
  "STAFF_VIEW",
  "STAFF_MANAGE",
  "BRANDING_MANAGE",
] as const;

export type StorePermission = (typeof STORE_PERMISSIONS)[number];

export const SENSITIVE_FINANCIAL_PERMISSIONS: StorePermission[] = [
  "PAYMENT_PROOF_APPROVE",
  "FINANCE_MANAGE",
  "DRIVER_PAYOUT_MANAGE",
  "PARTNER_PAYOUT_MANAGE",
  "TIP_PAYOUT_MANAGE",
  "PAYMENT_ACCOUNT_MANAGE",
];

export const STORE_STAFF_ROLE_LABEL: Record<StoreStaffRole, string> = {
  OWNER: "เจ้าของร้าน",
  ADMIN: "แอดมิน / ผู้จัดการ",
  STAFF: "พนักงาน",
};

export const STORE_PERMISSION_LABEL: Record<StorePermission, string> = {
  BOOKING_VIEW: "ดูงานจอง",
  BOOKING_MANAGE: "แก้ไขงานจอง",
  DISPATCH_VIEW: "ดูคิวงาน",
  DISPATCH_MANAGE: "จัดรถ/คนขับ",
  VEHICLE_VIEW: "ดูรถ",
  VEHICLE_MANAGE: "จัดการรถ",
  DRIVER_VIEW: "ดูคนขับ",
  DRIVER_MANAGE: "จัดการคนขับ",
  CUSTOMER_VIEW: "ดูลูกค้า",
  CUSTOMER_MANAGE: "จัดการลูกค้า",
  PAYMENT_VIEW: "ดูการชำระเงิน",
  PAYMENT_PROOF_APPROVE: "อนุมัติสลิป",
  FINANCE_VIEW: "ดูการเงิน",
  FINANCE_MANAGE: "จัดการการเงิน",
  DRIVER_PAYOUT_MANAGE: "จ่ายค่าตัวคนขับ",
  PARTNER_PAYOUT_MANAGE: "จ่ายพาร์ทเนอร์",
  TIP_PAYOUT_MANAGE: "จ่ายทิป",
  PAYMENT_ACCOUNT_MANAGE: "จัดการบัญชีรับเงิน",
  REPORT_VIEW: "ดูรายงาน",
  STORE_SETTINGS_VIEW: "ดูตั้งค่าร้าน",
  STORE_SETTINGS_MANAGE: "แก้ไขตั้งค่าร้าน",
  STAFF_VIEW: "ดูพนักงาน",
  STAFF_MANAGE: "จัดการพนักงาน",
  BRANDING_MANAGE: "จัดการแบรนด์ร้าน",
};

export const PERMISSION_GROUPS: { title: string; permissions: StorePermission[] }[] = [
  {
    title: "การจอง",
    permissions: ["BOOKING_VIEW", "BOOKING_MANAGE"],
  },
  {
    title: "คิวงาน",
    permissions: ["DISPATCH_VIEW", "DISPATCH_MANAGE"],
  },
  {
    title: "รถ / คนขับ",
    permissions: ["VEHICLE_VIEW", "VEHICLE_MANAGE", "DRIVER_VIEW", "DRIVER_MANAGE"],
  },
  {
    title: "ลูกค้า",
    permissions: ["CUSTOMER_VIEW", "CUSTOMER_MANAGE"],
  },
  {
    title: "การเงิน",
    permissions: [
      "PAYMENT_VIEW",
      "PAYMENT_PROOF_APPROVE",
      "FINANCE_VIEW",
      "FINANCE_MANAGE",
      "DRIVER_PAYOUT_MANAGE",
      "PARTNER_PAYOUT_MANAGE",
      "TIP_PAYOUT_MANAGE",
      "PAYMENT_ACCOUNT_MANAGE",
    ],
  },
  {
    title: "รายงาน",
    permissions: ["REPORT_VIEW"],
  },
  {
    title: "ตั้งค่าร้าน",
    permissions: [
      "STORE_SETTINGS_VIEW",
      "STORE_SETTINGS_MANAGE",
      "STAFF_VIEW",
      "STAFF_MANAGE",
      "BRANDING_MANAGE",
    ],
  },
];

export function permissionsForRole(role: StoreStaffRole): StorePermission[] {
  if (role === "OWNER") return [...STORE_PERMISSIONS];
  if (role === "ADMIN") {
    return STORE_PERMISSIONS.filter(
      (item) => !SENSITIVE_FINANCIAL_PERMISSIONS.includes(item) && item !== "STAFF_MANAGE",
    );
  }
  // STAFF — operational defaults, no financial authority / staff / branding
  return [
    "BOOKING_VIEW",
    "BOOKING_MANAGE",
    "DISPATCH_VIEW",
    "DISPATCH_MANAGE",
    "VEHICLE_VIEW",
    "DRIVER_VIEW",
    "CUSTOMER_VIEW",
    "PAYMENT_VIEW",
    "STORE_SETTINGS_VIEW",
  ];
}

export function sanitizePermissions(
  role: StoreStaffRole,
  requested: StorePermission[] | null | undefined,
  actorPermissions: StorePermission[],
): StorePermission[] {
  const base = requested?.length ? requested : permissionsForRole(role);
  const unique = [...new Set(base.filter((item) => STORE_PERMISSIONS.includes(item)))];
  // Cannot grant permissions the actor does not hold (except OWNER/super handled by caller)
  return unique.filter((item) => actorPermissions.includes(item));
}

export function legacyRoleFromStaffRole(
  staffRole: StoreStaffRole,
): "BUSINESS_OWNER" | "BUSINESS_STAFF" {
  return staffRole === "OWNER" ? "BUSINESS_OWNER" : "BUSINESS_STAFF";
}

export function staffRoleFromLegacy(
  role: "BUSINESS_OWNER" | "BUSINESS_STAFF" | "SUPER_ADMIN",
  staffRole?: StoreStaffRole | null,
): StoreStaffRole {
  if (staffRole && STORE_STAFF_ROLES.includes(staffRole)) return staffRole;
  return role === "BUSINESS_OWNER" ? "OWNER" : "STAFF";
}
