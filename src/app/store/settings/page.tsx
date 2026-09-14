import { SettingsForm } from "@/components/store-admin/SettingsForm";
import { requireStoreContext } from "@/lib/auth/tenant";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId || !ctx.business) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const tab = (await searchParams).tab ?? "store";
  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const accounts = await ctx.store.listPaymentAccounts(ctx.actor, ctx.businessId, { includeInactive: true });
  const publicStore = await ctx.store.getPublicStore(ctx.business.slug);
  const canManageStaff =
    ctx.session.role === "SUPER_ADMIN" ||
    board.staff.some(
      (member) =>
        member.userId === ctx.session.userId &&
        member.status === "ACTIVE" &&
        (member.staffRole === "OWNER" || member.permissions.includes("STAFF_MANAGE")),
    );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-navy-800">ตั้งค่าร้าน</h1>
      <SettingsForm
        businessId={ctx.businessId}
        business={ctx.business}
        settings={board.settings}
        staff={board.staff}
        accounts={accounts}
        tab={tab}
        canManageStaff={canManageStaff}
        province={publicStore?.province ?? null}
        region={publicStore?.region ?? null}
      />
    </div>
  );
}
