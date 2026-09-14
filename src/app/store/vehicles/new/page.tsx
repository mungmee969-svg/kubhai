import { VehicleForm } from "@/components/store-admin/VehicleForm";
import { requireStoreContext } from "@/lib/auth/tenant";

export default async function NewVehiclePage() {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-navy-800">เพิ่มรถ</h1>
      <VehicleForm businessId={ctx.businessId} />
    </div>
  );
}
