import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { logoutAction } from "@/lib/actions/auth";
import { actorFromSession, getSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/login");
  const businesses = await getStore().listBusinesses(actorFromSession(session));

  return (
    <div className="min-h-dvh bg-navy-950 text-white">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <p className="text-sm font-semibold">KubHai Super Admin</p>
            <p className="text-xs text-white/60">แพลตฟอร์ม · ไม่ใช่หน้าร้าน</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button className="text-xs text-white/70">ออกจากระบบ</button>
        </form>
      </header>
      <main className="mx-auto max-w-4xl px-5 pb-16">
        <h1 className="text-2xl font-semibold">ธุรกิจในระบบ</h1>
        <p className="mt-2 text-sm text-white/60">
          ร้านแนะนำแบบจ่ายเงินและอันดับออร์แกนิกแยกกัน Featured / Sponsored
          ไม่ไปยุ่ง ranking_score
        </p>
        <div className="mt-6 space-y-3">
          {businesses.map((business) => (
            <article key={business.id} className="rounded-3xl bg-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{business.name}</p>
                  <p className="text-sm text-white/60">/{business.slug}</p>
                  <p className="mt-2 text-xs text-white/50">
                    {business.status}
                    {business.sponsored ? " · Sponsored" : ""}
                    {business.featured ? " · Featured" : ""}
                    {business.isSeed ? " · seed" : ""}
                  </p>
                </div>
                <Link
                  href={`/s/${business.slug}`}
                  className="rounded-full bg-accent px-3 py-2 text-xs font-semibold text-navy-950"
                >
                  เปิดหน้าร้าน
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-8 text-sm text-white/50">
          การสร้างร้าน / แพ็กเกจ / marketplace ยังไม่เปิดในรอบนี้
        </p>
      </main>
    </div>
  );
}
