"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveVehicleAction, setVehicleActiveAction, uploadImageAction } from "@/lib/actions/ops";
import { resolveVehicleCoverUrl } from "@/lib/domain/vehicle-image";
import type { Vehicle } from "@/lib/domain/types";

const MAX_IMAGES = 8;

export function VehicleForm({
  businessId,
  vehicle,
}: {
  businessId: string;
  vehicle?: Vehicle;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownershipType, setOwnershipType] = useState(vehicle?.ownershipType ?? "OWN");
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType ?? "VAN");
  const [brand, setBrand] = useState(vehicle?.brand ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : "");
  const [color, setColor] = useState(vehicle?.color ?? "");
  const [plateNumber, setPlateNumber] = useState(vehicle?.plateNumber ?? "");
  const [seats, setSeats] = useState(vehicle?.seats ?? 7);
  const [luggageCapacity, setLuggageCapacity] = useState(vehicle?.luggageCapacity ?? 4);
  const [description, setDescription] = useState(vehicle?.description ?? "");
  const [amenities, setAmenities] = useState(vehicle?.amenities.join(", ") ?? "แอร์");
  const [basePrice, setBasePrice] = useState(vehicle?.basePrice ? String(vehicle.basePrice) : "");
  const [pricingUnit, setPricingUnit] = useState(vehicle?.pricingUnit ?? "วัน");
  const initialImages = (() => {
    const urls = [...(vehicle?.imageUrls ?? [])];
    if (vehicle?.coverImageUrl && !urls.includes(vehicle.coverImageUrl)) {
      urls.unshift(vehicle.coverImageUrl);
    }
    return urls.slice(0, MAX_IMAGES);
  })();
  const [imageUrls, setImageUrls] = useState<string[]>(initialImages);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    vehicle?.coverImageUrl ?? initialImages[0] ?? null,
  );
  const [active, setActive] = useState(vehicle?.active ?? true);

  const coverPreview = resolveVehicleCoverUrl({
    coverImageUrl,
    imageUrls,
    vehicleType,
    model,
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const cleaned = imageUrls.slice(0, MAX_IMAGES);
    const cover =
      coverImageUrl && cleaned.includes(coverImageUrl) ? coverImageUrl : cleaned[0] ?? null;
    const result = await saveVehicleAction(businessId, {
      id: vehicle?.id,
      ownershipType,
      vehicleType,
      brand,
      model,
      year: year ? Number(year) : null,
      color: color || null,
      plateNumber: plateNumber || null,
      seats,
      luggageCapacity,
      description: description || null,
      amenities: amenities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      basePrice: basePrice ? Number(basePrice) : null,
      pricingUnit,
      imageUrls: cleaned,
      coverImageUrl: cover,
      status: active ? "ACTIVE" : "INACTIVE",
      active,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/store/vehicles");
    router.refresh();
  }

  async function onUpload(file: File) {
    if (imageUrls.length >= MAX_IMAGES) {
      setError(`อัปโหลดได้สูงสุด ${MAX_IMAGES} รูป`);
      return;
    }
    setUploading(true);
    setError(null);
    const data = new FormData();
    data.set("file", file);
    data.set("businessId", businessId);
    const result = await uploadImageAction(data);
    setUploading(false);
    if (!result.ok || !result.data) {
      setError(result.ok ? "อัปโหลดไม่สำเร็จ" : result.error);
      return;
    }
    setImageUrls((current) => {
      const next = [...current, result.data!.url].slice(0, MAX_IMAGES);
      if (!coverImageUrl) setCoverImageUrl(result.data!.url);
      return next;
    });
  }

  function moveImage(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= imageUrls.length) return;
    setImageUrls((current) => {
      const next = [...current];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  function removeImage(url: string) {
    setImageUrls((current) => {
      const next = current.filter((item) => item !== url);
      if (coverImageUrl === url) setCoverImageUrl(next[0] ?? null);
      return next;
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl bg-white p-4 sm:p-5">
      <section className="space-y-2">
        <p className="text-sm font-medium text-navy-800">รูปภาพรถ</p>
        <div className="overflow-hidden rounded-2xl bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverPreview} alt="" className="h-40 w-full object-cover sm:h-48" />
          <p className="px-3 py-1.5 text-[11px] text-muted">รูปปก · แสดงตอนเลือกรถ</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {imageUrls.map((url, index) => (
            <div
              key={url}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-2 ${
                coverImageUrl === url ? "ring-accent" : "ring-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex gap-0.5 bg-black/55 p-0.5">
                <button type="button" className="flex-1 text-[9px] text-white" onClick={() => setCoverImageUrl(url)}>
                  ปก
                </button>
                <button type="button" className="px-1 text-[9px] text-white" onClick={() => moveImage(index, -1)}>
                  ‹
                </button>
                <button type="button" className="px-1 text-[9px] text-white" onClick={() => moveImage(index, 1)}>
                  ›
                </button>
                <button type="button" className="px-1 text-[9px] text-white" onClick={() => removeImage(url)}>
                  ×
                </button>
              </div>
            </div>
          ))}
          {imageUrls.length < MAX_IMAGES ? (
            <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper text-[10px] text-muted">
              {uploading ? "…" : "+ เพิ่มรูป"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void onUpload(file);
                }}
              />
            </label>
          ) : null}
        </div>
        <p className="text-[11px] text-muted">
          แนะนำ: ด้านหน้า · ด้านข้าง · ภายใน · เบาะ · สัมภาระ — ไม่บังคับ · สูงสุด {MAX_IMAGES} รูป
        </p>
      </section>

      <label className="block text-sm text-muted">
        ความเป็นเจ้าของ
        <select
          className="admin-input mt-1"
          value={ownershipType}
          onChange={(e) => setOwnershipType(e.target.value as "OWN" | "PARTNER")}
        >
          <option value="OWN">OWN · รถร้าน</option>
          <option value="PARTNER">PARTNER · รถพาร์ทเนอร์</option>
        </select>
      </label>
      <label className="block text-sm text-muted">
        ประเภทรถ
        <input
          className="admin-input mt-1"
          placeholder="เช่น VAN / SUV"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
        />
      </label>
      <label className="block text-sm text-muted">
        ยี่ห้อ
        <input className="admin-input mt-1" required value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <label className="block text-sm text-muted">
        รุ่น
        <input className="admin-input mt-1" required value={model} onChange={(e) => setModel(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-muted">
          ปี
          <input className="admin-input mt-1" value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <label className="block text-sm text-muted">
          สี
          <input className="admin-input mt-1" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
      </div>
      <label className="block text-sm text-muted">
        ทะเบียน (ภายในร้าน)
        <input className="admin-input mt-1" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-muted">
          จำนวนผู้โดยสาร
          <input
            className="admin-input mt-1"
            type="number"
            min={1}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
          />
        </label>
        <label className="block text-sm text-muted">
          จำนวนสัมภาระ
          <input
            className="admin-input mt-1"
            type="number"
            min={0}
            value={luggageCapacity}
            onChange={(e) => setLuggageCapacity(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="block text-sm text-muted">
        สิ่งอำนวยความสะดวก (คั่นด้วย comma)
        <input className="admin-input mt-1" value={amenities} onChange={(e) => setAmenities(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-muted">
          ราคาเริ่มต้น
          <input className="admin-input mt-1" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
        </label>
        <label className="block text-sm text-muted">
          หน่วยราคา
          <input className="admin-input mt-1" value={pricingUnit} onChange={(e) => setPricingUnit(e.target.value)} />
        </label>
      </div>
      <label className="block text-sm text-muted">
        รายละเอียด
        <textarea
          className="admin-input mt-1 min-h-24 py-3"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        แสดงหน้าร้าน (active)
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        disabled={pending || uploading}
        className="h-12 w-full rounded-2xl bg-accent font-semibold text-navy-950 disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก..." : "บันทึกรถ"}
      </button>
      {vehicle ? (
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await setVehicleActiveAction(vehicle.id, !vehicle.active);
            setPending(false);
            router.refresh();
          }}
          className="h-11 w-full rounded-2xl bg-paper text-sm"
        >
          {vehicle.active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
        </button>
      ) : null}
    </form>
  );
}
