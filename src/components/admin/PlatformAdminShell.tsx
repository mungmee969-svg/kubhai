import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { logoutAction } from "@/lib/actions/auth";

export function PlatformAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-navy-950 text-white">
      <header className="mx-auto max-w-6xl px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-3">
            <BrandMark size={40} />
            <div>
              <p className="text-sm font-semibold">KubHai Platform Admin</p>
              <p className="text-xs text-white/60">SaaS · ไม่ใช่หน้าร้าน</p>
            </div>
          </Link>
          <form action={logoutAction}>
            <button className="text-xs text-white/70">ออกจากระบบ</button>
          </form>
        </div>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Platform Admin">
          <Link href="/admin" className="rounded-full bg-white/10 px-3 py-2">Dashboard</Link>
          <Link href="/admin/website" className="rounded-full bg-white/10 px-3 py-2">เว็บไซต์</Link>
          <Link href="/admin/places" className="rounded-full bg-white/10 px-3 py-2">ตรวจสถานที่</Link>
          <Link href="/admin/stores" className="rounded-full bg-white/10 px-3 py-2">Stores</Link>
          <Link href="/admin/saas-payments" className="rounded-full bg-white/10 px-3 py-2">SaaS Payment Review</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16">{children}</main>
    </div>
  );
}
