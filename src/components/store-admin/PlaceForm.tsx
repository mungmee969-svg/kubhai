"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  archivePlaceAction,
  savePlaceAction,
  setPlaceActiveAction,
  uploadImageAction,
} from "@/lib/actions/ops";
import { PLACE_CATEGORIES, PLACE_CATEGORY_LABELS, type PlaceCategory } from "@/lib/domain/enums";
import { isFleetImageUrl, resolvePlaceImageUrl } from "@/lib/domain/place-image";
import type { Place } from "@/lib/domain/types";
import { PlaceLocationField } from "@/components/store-admin/PlaceLocationField";
import { Feedback } from "./ui/Feedback";

const MAX_IMAGES = 8;

export function PlaceForm({
  businessId,
  place,
}: {
  businessId: string;
  place?: Place;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<PlaceCategory>(place?.category ?? "ATTRACTION");
  const [name, setName] = useState(place?.name ?? "");
  const [shortDescription, setShortDescription] = useState(place?.shortDescription ?? "");
  const [description, setDescription] = useState(place?.description ?? "");
  const [address, setAddress] = useState(place?.address ?? "");
  const [area, setArea] = useState(place?.area ?? "");
  const [latitude, setLatitude] = useState(place?.latitude != null ? String(place.latitude) : "");
  const [longitude, setLongitude] = useState(place?.longitude != null ? String(place.longitude) : "");
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(
    place?.googlePlaceId ?? null,
  );
  const initialImages = (() => {
    const urls = [...(place?.imageUrls ?? [])];
    if (place?.coverImageUrl && !urls.includes(place.coverImageUrl)) {
      urls.unshift(place.coverImageUrl);
    }
    return urls.filter((url) => url && !isFleetImageUrl(url)).slice(0, MAX_IMAGES);
  })();
  const [imageUrls, setImageUrls] = useState<string[]>(initialImages);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    place?.coverImageUrl && !isFleetImageUrl(place.coverImageUrl)
      ? place.coverImageUrl
      : initialImages[0] ?? null,
  );
  const [localRecommended, setLocalRecommended] = useState(place?.localRecommended ?? false);
  const [minutes, setMinutes] = useState(
    place?.estimatedDurationMinutes ? String(place.estimatedDurationMinutes) : "",
  );
  const [active, setActive] = useState(place?.status !== "HIDDEN");

  const coverPreview = coverImageUrl
    ? resolvePlaceImageUrl({
        coverImageUrl,
        imageUrls,
        category,
      })
    : resolvePlaceImageUrl({ coverImageUrl: null, imageUrls, category });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const lat = latitude.trim() ? Number(latitude) : null;
    const lng = longitude.trim() ? Number(longitude) : null;
    if ((latitude.trim() && !Number.isFinite(lat)) || (longitude.trim() && !Number.isFinite(lng))) {
      setPending(false);
      setError("พิกัดไม่ถูกต้อง");
      return;
    }
    const cleaned = imageUrls.filter((url) => url && !isFleetImageUrl(url)).slice(0, MAX_IMAGES);
    const cover =
      coverImageUrl && cleaned.includes(coverImageUrl)
        ? coverImageUrl
        : cleaned[0] ?? null;
    const result = await savePlaceAction(businessId, {
      id: place?.id,
      category,
      name,
      shortDescription: shortDescription || null,
      description: description || null,
      address: address || null,
      area: area || null,
      latitude: lat,
      longitude: lng,
      googlePlaceId: googlePlaceId || null,
      imageUrls: cleaned,
      coverImageUrl: cover,
      localRecommended,
      estimatedDurationMinutes: minutes ? Number(minutes) : null,
      status: active ? "ACTIVE" : "HIDDEN",
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/store/places");
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
    if (isFleetImageUrl(result.data.url)) {
      setError("ห้ามใช้รูปรถเป็นรูปสถานที่");
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
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-4 sm:p-5">
      <section className="space-y-2">
        <p className="text-sm font-medium text-navy-800">รูปสถานที่</p>
        <div className="overflow-hidden rounded-2xl bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverPreview} alt="" className="h-40 w-full object-cover sm:h-44" />
          <p className="px-3 py-1.5 text-[11px] text-muted">รูปปก · แสดงในเที่ยวแนะนำ</p>
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
                <button
                  type="button"
                  className="flex-1 text-[9px] text-white"
                  onClick={() => setCoverImageUrl(url)}
                >
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
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) await onUpload(file);
                }}
              />
            </label>
          ) : null}
        </div>
        <p className="text-[11px] text-muted">
          สูงสุด {MAX_IMAGES} รูป · JPEG/PNG/WebP ≤ 4MB · ไม่ใช้รูปรถเป็น fallback
        </p>
      </section>

      <label className="block text-sm text-muted">
        หมวดหมู่
        <select
          className="admin-input mt-1"
          value={category}
          onChange={(e) => setCategory(e.target.value as PlaceCategory)}
        >
          {PLACE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {PLACE_CATEGORY_LABELS[item]}
            </option>
          ))}
        </select>
      </label>

      <input
        className="admin-input"
        required
        placeholder="ชื่อสถานที่"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        className="admin-input min-h-16 py-3"
        placeholder="คำอธิบายสั้น"
        value={shortDescription}
        onChange={(e) => setShortDescription(e.target.value)}
      />
      <textarea
        className="admin-input min-h-24 py-3"
        placeholder="รายละเอียด"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <PlaceLocationField
        value={{ address, area, latitude, longitude, googlePlaceId }}
        onChange={(next) => {
          setAddress(next.address);
          setArea(next.area);
          setLatitude(next.latitude);
          setLongitude(next.longitude);
          setGooglePlaceId(next.googlePlaceId);
        }}
        onApplyName={(label) => {
          if (!name.trim()) setName(label);
        }}
      />

      <input
        className="admin-input"
        placeholder="เวลาโดยประมาณ (นาที) — ไม่บังคับ"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={localRecommended}
          onChange={(e) => setLocalRecommended(e.target.checked)}
        />
        คนพื้นที่แนะนำ
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        แสดงในหน้าร้าน
      </label>

      <Feedback error={error} />
      <button
        disabled={pending || uploading}
        className="h-11 w-full rounded-xl bg-accent font-semibold text-navy-950 disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก..." : "บันทึก"}
      </button>

      {place?.businessId ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await setPlaceActiveAction(place.id, place.status === "HIDDEN");
              setPending(false);
              router.refresh();
            }}
            className="h-11 rounded-xl bg-paper text-sm"
          >
            {place.status === "HIDDEN" ? "แสดงในหน้าร้าน" : "ซ่อนจากหน้าร้าน"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (!window.confirm("ซ่อน/เก็บถาวรสถานที่นี้? ประวัติทริปเดิมจะไม่ถูกลบ")) return;
              setPending(true);
              const result = await archivePlaceAction(place.id);
              setPending(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.push("/store/places");
              router.refresh();
            }}
            className="h-11 rounded-xl bg-paper text-sm text-danger"
          >
            เก็บถาวร / ซ่อน
          </button>
        </div>
      ) : null}
    </form>
  );
}
