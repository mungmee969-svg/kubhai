export const STORE_NAV = [
  { href: "/store", label: "ภาพรวม", exact: true },
  { href: "/store/bookings", label: "งานจอง" },
  { href: "/store/calendar", label: "ตารางเดินรถ" },
  { href: "/store/vehicles", label: "รถ" },
  { href: "/store/drivers", label: "คนขับ" },
  { href: "/store/customers", label: "ลูกค้า" },
  { href: "/store/places", label: "ทริป / สถานที่" },
  { href: "/store/trip-packages", label: "แพ็กเกจทริป" },
  { href: "/store/finance", label: "การเงิน" },
  { href: "/store/reports", label: "รายงาน" },
  { href: "/store/billing", label: "แพ็กเกจและการชำระเงิน" },
  { href: "/store/settings", label: "ตั้งค่าร้าน" },
] as const;

export const MOBILE_NAV = [
  { href: "/store", label: "ภาพรวม", exact: true },
  { href: "/store/bookings", label: "งานจอง" },
  { href: "/store/calendar", label: "คิวงาน" },
  { href: "/store/vehicles", label: "รถ" },
] as const;

export const APP_VERSION = "0.1.0";
