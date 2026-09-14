import { DriverForm } from "@/components/store-admin/DriverForm";
import { requireStoreContext } from "@/lib/auth/tenant";

export default async function NewDriverPage() {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-navy-800">เพิ่มคนขับ</h1>
      <DriverForm businessId={ctx.businessId} />
    </div>
  );
}
