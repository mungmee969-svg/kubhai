import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { StoreDrawer } from "@/components/store-admin/shell/StoreDrawer";
import { StoreMobileNav, StoreNavLinks } from "@/components/store-admin/shell/StoreNavLinks";
import { NotificationCenter } from "@/components/store-admin/shell/NotificationCenter";
import { StoreSearch } from "@/components/store-admin/shell/StoreSearch";
import { APP_VERSION } from "@/components/store-admin/shell/nav";
import { PoweredByKubHaiSubtle, StoreBrandScope, StoreLogo } from "@/components/brand/StoreBrand";
import { logoutAction } from "@/lib/actions/auth";
import { getSession } from "@/lib/auth/session";
import { requireStoreContext } from "@/lib/auth/tenant";
import { allowsTripPackages } from "@/lib/domain/booking-entitlements";
import { resolveBusinessBranding } from "@/lib/domain/branding";
import { operationalBookings } from "@/lib/domain/fixtures";
import { deriveNotifications, bookingWorkloadBadgeCount, notificationBadgeCounts } from "@/lib/domain/ops";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-kubhai-pathname") ?? "";
  const isLogin = pathname === "/store/login" || pathname.startsWith("/store/login/");

  if (isLogin) {
    const session = await getSession();
    if (session && session.role !== "CUSTOMER") redirect("/store");
    return children;
  }

  const session = await getSession();
  if (!session) return children;

  const ctx = await requireStoreContext();
  if (!ctx.businessId || !ctx.business) {
    return <div className="p-8 text-sm text-muted">บัญชีนี้ยังไม่มีร้าน</div>;
  }
  if (ctx.session.role === "CUSTOMER") redirect("/store/login");

  const brand = resolveBusinessBranding(ctx.business);
  const bookings = operationalBookings(await ctx.store.listBookings(ctx.actor, ctx.businessId));
  const [proofs, quotations, dayLogs, suggestions, reads] = await Promise.all([
    ctx.store.listPaymentProofs(ctx.actor, ctx.businessId),
    ctx.store.listQuotations(ctx.actor, ctx.businessId),
    ctx.store.listDriverDayLogs(ctx.actor, ctx.businessId),
    ctx.store.listDriverRouteSuggestions(ctx.actor, ctx.businessId),
    ctx.store.listNotificationReads(ctx.actor, ctx.businessId),
  ]);
  const notifications = deriveNotifications({
    bookings,
    proofs,
    quotations,
    dayLogs,
    suggestions,
    readIds: reads.map((item) => item.notificationId),
  });
  const notifBadges = notificationBadgeCounts(notifications);
  const pendingProofIds = proofs
    .filter((item) => item.reviewStatus === "PENDING_REVIEW")
    .map((item) => item.bookingId);
  const badges = {
    ...notifBadges,
    bookings: bookingWorkloadBadgeCount(bookings, pendingProofIds),
  };
  const hiddenNavHrefs = allowsTripPackages(ctx.business.subscriptionPlan)
    ? []
    : ["/store/trip-packages"];

  return (
    <StoreBrandScope brand={brand} className="min-h-dvh min-w-0 overflow-x-hidden bg-paper">
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line print:hidden lg:flex"
        style={{ background: brand.primaryColor, color: "#fff" }}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <StoreLogo brand={brand} size={36} className="bg-white" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{brand.businessName}</p>
            <p className="text-[11px] text-white/70">ระบบงานร้าน</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto text-white [&_a]:text-white/85 [&_a[aria-current=page]]:bg-white/15 [&_a[aria-current=page]]:text-white">
          <StoreNavLinks storeSlug={ctx.business.slug} badges={badges} hiddenHrefs={hiddenNavHrefs} />
        </div>
        <div className="border-t border-white/15 px-4 py-4 text-xs text-white/70">
          <Link href="/store/settings" className="block text-white">ตั้งค่าร้าน</Link>
          <p className="mt-2">v{APP_VERSION}</p>
          <PoweredByKubHaiSubtle enabled={brand.poweredByKubHaiEnabled} className="mt-2 justify-start text-white/50" />
          <p className="mt-2 truncate text-white">{ctx.session.email}</p>
          <form action={logoutAction} className="mt-2"><button className="text-white">ออกจากระบบ</button></form>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur print:hidden">
          <div className="flex min-w-0 items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
            <StoreDrawer businessName={brand.businessName} storeSlug={ctx.business.slug} badges={badges} hiddenHrefs={hiddenNavHrefs} />
            <div className="min-w-0 flex-1 sm:flex-none">
              <p className="truncate text-sm font-semibold text-navy-800">{brand.businessName}</p>
              <p className="truncate text-[11px] text-muted">{ctx.session.role === "BUSINESS_STAFF" ? "พนักงานร้าน" : "เจ้าของร้าน"}</p>
            </div>
            <div className="hidden min-w-0 flex-1 sm:block"><StoreSearch businessId={ctx.businessId} /></div>
            <div className="shrink-0"><NotificationCenter businessId={ctx.businessId} initial={notifications} /></div>
            <div className="hidden max-w-48 text-right text-xs text-muted md:block"><p className="truncate text-navy-800">{ctx.session.email}</p></div>
          </div>
        </header>
        <main className="min-w-0 overflow-x-hidden px-3 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-6 lg:overflow-visible lg:px-8 lg:pb-8 print:p-0">
          {children}
        </main>
      </div>
      <div className="print:hidden"><StoreMobileNav badges={badges} /></div>
    </StoreBrandScope>
  );
}