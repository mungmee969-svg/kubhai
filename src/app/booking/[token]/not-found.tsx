import Link from "next/link";

export default async function BookingNotFound({
  params,
}: {
  params?: Promise<{ token?: string }>;
}) {
  const resolved = params ? await params : undefined;
  const token = resolved?.token ?? "";
  const urlConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const keyConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );

  return (
    <div className="min-h-dvh bg-paper px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">ไม่พบการจองนี้</h1>
      <p className="mt-2 text-sm text-muted">
        ระบบยังอ่านรายละเอียดการจองจากฐานข้อมูลไม่ได้
      </p>

      <div className="mx-auto mt-6 max-w-md rounded-2xl border border-black/10 bg-white p-4 text-left text-xs leading-6 text-slate-600">
        <p className="font-semibold text-slate-900">Booking diagnostic</p>
        <p>route: /booking/[token]</p>
        <p>token received: {token ? "YES" : "NO"}</p>
        <p>token length: {token.length}</p>
        <p>Supabase URL: {urlConfigured ? "CONFIGURED" : "MISSING"}</p>
        <p>Supabase key: {keyConfigured ? "CONFIGURED" : "MISSING"}</p>
        <p className="mt-2 break-all">token tail: {token ? token.slice(-8) : "-"}</p>
      </div>

      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white"
      >
        กลับหน้าหลัก
      </Link>
    </div>
  );
}
