"use client";

import { useEffect, useRef, useState } from "react";
import { resolveVehicleCoverUrl, resolveVehicleGallery } from "@/lib/domain/vehicle-image";
import { displayVehicleName } from "@/lib/booking/draft";
import type { Vehicle } from "@/lib/domain/types";

/**
 * Customer vehicle photo gallery — overlay only.
 * Must not navigate away or clear booking draft.
 */
export function VehicleGallerySheet({
  vehicle,
  open,
  onClose,
}: {
  vehicle: Vehicle | null;
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const gallery = vehicle ? resolveVehicleGallery(vehicle) : [];
  const images =
    gallery.length > 0
      ? gallery
      : vehicle
        ? [resolveVehicleCoverUrl(vehicle)]
        : [];

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((i) => Math.min(images.length - 1, i + 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length, onClose]);

  if (!open || !vehicle) return null;
  const name = displayVehicleName(`${vehicle.brand} ${vehicle.model}`);
  const current = images[Math.min(index, images.length - 1)] ?? resolveVehicleCoverUrl(vehicle);

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || images.length < 2) return;
    const end = event.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) setIndex((i) => Math.min(images.length - 1, i + 1));
    else setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-navy-950/55" aria-label="ปิด" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-y-8 sm:bottom-auto sm:rounded-3xl">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy-800">{name}</p>
            <p className="text-xs text-muted">
              {vehicle.seats} ที่นั่ง · สัมภาระ {vehicle.luggageCapacity} ใบ
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-9 rounded-full bg-paper px-3 text-sm">
            ปิด
          </button>
        </div>
        <div
          className="relative touch-pan-y bg-paper"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt="" className="max-h-[55vh] w-full object-contain" draggable={false} />
          {images.length > 1 ? (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg shadow sm:flex"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label="รูปก่อนหน้า"
              >
                ‹
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg shadow sm:flex"
                onClick={() => setIndex((i) => Math.min(images.length - 1, i + 1))}
                aria-label="รูปถัดไป"
              >
                ›
              </button>
            </>
          ) : null}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm text-muted">
            {Math.min(index + 1, images.length)} / {images.length}
          </p>
          {images.length > 1 ? (
            <div className="flex gap-2 sm:hidden">
              <button
                type="button"
                className="h-9 rounded-full bg-paper px-3 text-sm"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                ก่อนหน้า
              </button>
              <button
                type="button"
                className="h-9 rounded-full bg-navy-800 px-3 text-sm text-white"
                onClick={() => setIndex((i) => Math.min(images.length - 1, i + 1))}
              >
                ถัดไป
              </button>
            </div>
          ) : null}
        </div>
        {images.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto px-4 pb-4 scrollbar-none">
            {images.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-14 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ${
                  i === index ? "ring-accent" : "ring-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
