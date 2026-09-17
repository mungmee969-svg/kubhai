import Link from "next/link";

export default function BookingNotFound() {
  return (
    <div className="min-h-dvh bg-paper px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">ไม่พบการจองนี้</h1>
      <p className="mt-2 text-sm text-muted">
        ลิงก์ไม่ถูกต้อง หรือไม่พบข้อมูลการจอง
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white"
      >
        กลับหน้าหลัก
      </Link>
    </div>
  );
}
