import Link from "next/link";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { requireStoreContext } from "@/lib/auth/tenant";
import { formatThaiDate } from "@/lib/domain/ops";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const q = ((await searchParams).q ?? "").trim().toLowerCase();
  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const rows = board.customers
    .filter((customer) => {
      if (!q) return true;
      return `${customer.name} ${customer.phone ?? ""} ${customer.email ?? ""}`.toLowerCase().includes(q);
    })
    .map((customer) => {
      const history = board.bookings
        .filter((item) => item.customerId === customer.id)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
      return {
        customer,
        latest: history[0] ?? null,
        total: history.length,
        completed: history.filter((item) => item.status === "COMPLETED").length,
      };
    });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy-800">ลูกค้า</h1>
      <form className="mt-4">
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อ / เบอร์ / อีเมล" className="admin-input max-w-md" />
      </form>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? <EmptyState title="ยังไม่มีลูกค้าในระบบ" hint="ลูกค้าจะถูกสร้างเมื่อมีคำขอจอง" /> : null}
        {rows.map(({ customer, latest, total, completed }) => (
          <Link key={customer.id} href={`/store/customers/${customer.id}`} className="block rounded-2xl bg-white p-4">
            <p className="font-semibold text-navy-800">{customer.name}</p>
            <p className="mt-1 text-sm text-muted">{customer.phone ?? "ไม่มีเบอร์"}</p>
            <p className="mt-2 text-xs text-muted">
              ล่าสุด {latest ? `${latest.bookingCode} · ${formatThaiDate(latest.startDate)}` : "—"}
              {" · "}
              รวม {total} งาน · สำเร็จ {completed}
              {" · "}
              กิจกรรมล่าสุด {customer.updatedAt.slice(0, 10)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
