import { PlaceForm } from "@/components/store-admin/PlaceForm";
import { requireStoreContext } from "@/lib/auth/tenant";

export default async function NewPlacePage() {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-navy-800">เพิ่มสถานที่</h1>
      <PlaceForm businessId={ctx.businessId} />
    </div>
  );
}
