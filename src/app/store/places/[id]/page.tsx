import { notFound } from "next/navigation";
import { PlaceForm } from "@/components/store-admin/PlaceForm";
import { requireStoreContext } from "@/lib/auth/tenant";

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const { id } = await params;
  const places = await ctx.store.listPlaces(ctx.actor, ctx.businessId);
  const place = places.find((item) => item.id === id && item.businessId === ctx.businessId);
  if (!place) notFound();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-navy-800">แก้ไขสถานที่</h1>
      <PlaceForm businessId={ctx.businessId} place={place} />
    </div>
  );
}
