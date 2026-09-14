import Link from "next/link";

export default function StoreNotFound() {
  return (
    <div className="min-h-dvh bg-paper px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">ไม่พบร้านนี้</h1>
      <p className="mt-2 text-sm text-muted">slug ไม่ตรงกับร้านที่เปิดใช้งาน</p>
      <Link href="/" className="mt-6 inline-block text-navy-700 font-medium">
        กลับหน้า KubHai
      </Link>
    </div>
  );
}
