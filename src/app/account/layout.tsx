import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { customerLogoutAction } from "@/lib/actions/customer-auth";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { platformLoginHref } from "@/lib/auth/customer-auth-links";
import { kubhaiBrand } from "@/lib/brand/tokens";

/**
 * Logged-in account chrome defaults to KubHai platform branding.
 * Never inherit last-store / POND for the account shell.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();

  // Login page owns its full chrome (layout still wraps but login page is full-bleed).
  // Detect via children-only passthrough is handled by login page being self-contained;
  // we still render header for /account/* except login — login page uses its own min-h-dvh.
  // Use pathname header when available.
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const pathname = headerList.get("x-kubhai-pathname") ?? "";
  if (pathname.startsWith("/account/login")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-dvh bg-[#f6f3ee] text-navy-950">
      <header className="bg-navy-800 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <BrandMark size={36} className="bg-white" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {kubhaiBrand.name} · {kubhaiBrand.nameTh}
              </p>
              <p className="text-[11px] text-white/70">บัญชีลูกค้า</p>
            </div>
          </Link>
          {session ? (
            <form action={customerLogoutAction}>
              <button className="text-xs text-white/80">ออกจากระบบ</button>
            </form>
          ) : (
            <Link href={platformLoginHref("/account")} className="text-xs text-white/80">
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
        {session ? (
          <nav className="mx-auto flex max-w-lg gap-4 overflow-x-auto px-5 pb-3 text-sm text-white/80">
            <Link href="/account">ภาพรวม</Link>
            <Link href="/account/bookings">การจองของฉัน</Link>
            <Link href="/account/profile">โปรไฟล์</Link>
            <Link href="/account/security">ความปลอดภัย</Link>
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-lg px-5 py-6">{children}</main>
      <footer className="mx-auto max-w-lg px-5 pb-10 text-center text-xs text-muted">
        KubHai · ขับให้
      </footer>
    </div>
  );
}
