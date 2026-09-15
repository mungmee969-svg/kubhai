import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { logoutAction } from "@/lib/actions/auth";

const NAV_ITEMS = [
  { href: "/admin", label: "ภาพรวม", description: "Dashboard" },
  { href: "/admin/stores", label: "ร้าน Partner", description: "Partners" },
  { href: "/admin/saas-payments", label: "ตรวจสอบการชำระเงิน", description: "Payment review" },
  { href: "/admin/places", label: "สถานที่และเนื้อหา", description: "Places" },
  { href: "/admin/website", label: "เว็บไซต์ KubHai", description: "Website CMS" },
] as const;

export function PlatformAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex min-w-0 items-center gap-3" aria-label="KubHai Platform Admin">
            <span className="shrink-0 rounded-2xl bg-slate-50 p-1 ring-1 ring-slate-200">
              <BrandMark size={40} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">KubHai Platform Admin</p>
              <p className="truncate text-xs text-slate-500">ศูนย์บริหารแพลตฟอร์มและร้าน Partner</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" target="_blank" className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex">
              ดูหน้าเว็บ
            </Link>
            <form action={logoutAction}>
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 lg:py-7">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Platform Admin">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group min-w-max rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 lg:min-w-0"
              >
                <span className="block text-sm font-semibold text-slate-900 group-hover:text-blue-700">{item.label}</span>
                <span className="hidden text-xs text-slate-500 lg:block">{item.description}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-4 hidden rounded-2xl border border-blue-100 bg-blue-50 p-4 lg:block">
            <p className="text-xs font-semibold text-blue-900">Platform Owner</p>
            <p className="mt-1 text-xs leading-5 text-blue-700">ตรวจร้าน การชำระเงิน เนื้อหา และหน้าเว็บได้จากเมนูนี้</p>
          </div>
        </aside>

        <main className="min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}
