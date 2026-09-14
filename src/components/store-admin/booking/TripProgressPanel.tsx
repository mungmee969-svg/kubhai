"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordTripCheckInAction, startTripAction } from "@/lib/actions/trip";
import type { BookingRecord } from "@/lib/data/repository";
import {
  LOCATION_OVERRIDE_LABELS,
  LOCATION_OVERRIDE_REASONS,
  TRIP_PROGRESS_LABEL,
  deriveTripProgress,
  proximityBand,
  proximityLabel,
  type LocationOverrideReason,
  type TripCheckIn,
} from "@/lib/domain/location";

type Props = {
  record: BookingRecord;
  onOpenCloseout: () => void;
  canCloseout: boolean;
};

export function TripProgressPanel({ record, onOpenCloseout, canCloseout }: Props) {
  const router = useRouter();
  const booking = record.booking;
  const pickupCi = record.tripCheckIns.find((item) => item.kind === "PICKUP") ?? null;
  const dropoffCi = record.tripCheckIns.find((item) => item.kind === "DROPOFF") ?? null;
  const progress = deriveTripProgress({
    status: booking.status,
    actualStartAt: booking.actualStartAt,
    pickupCheckIn: pickupCi,
    dropoffCheckIn: dropoffCi,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [overrideReason, setOverrideReason] = useState<LocationOverrideReason | "">("");
  const [note, setNote] = useState("");
  const [previewDistance, setPreviewDistance] = useState<number | null>(null);
  const [previewKind, setPreviewKind] = useState<"PICKUP" | "DROPOFF" | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(
    null,
  );

  const opsReady = booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS";

  async function readDevicePosition(): Promise<{
    lat: number;
    lng: number;
    accuracy: number | null;
  }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("อุปกรณ์ไม่รองรับ GPS"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          }),
        () => reject(new Error("อ่านตำแหน่งไม่สำเร็จ — ลองใหม่หรือใส่พิกัดทดสอบ")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }

  function expectedFor(kind: "PICKUP" | "DROPOFF") {
    if (kind === "PICKUP" && booking.pickupLat != null && booking.pickupLng != null) {
      return { latitude: booking.pickupLat, longitude: booking.pickupLng };
    }
    if (kind === "DROPOFF" && booking.dropoffLat != null && booking.dropoffLng != null) {
      return { latitude: booking.dropoffLat, longitude: booking.dropoffLng };
    }
    return null;
  }

  async function beginCheckIn(kind: "PICKUP" | "DROPOFF") {
    setError(null);
    setPending(true);
    try {
      const pos = await readDevicePosition();
      setCoords(pos);
      const expected = expectedFor(kind);
      let distance: number | null = null;
      if (expected) {
        const { distanceMeters } = await import("@/lib/domain/location");
        distance = distanceMeters(expected, { latitude: pos.lat, longitude: pos.lng });
      }
      setPreviewDistance(distance);
      setPreviewKind(kind);
      const band = proximityBand(distance);
      if (band !== "FAR") {
        await submitCheckIn(kind, pos, null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยังบันทึกเช็กอินไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  async function submitCheckIn(
    kind: "PICKUP" | "DROPOFF",
    pos: { lat: number; lng: number; accuracy: number | null },
    reason: LocationOverrideReason | null,
  ) {
    setPending(true);
    setError(null);
    const result = await recordTripCheckInAction(booking.id, {
      kind,
      latitude: pos.lat,
      longitude: pos.lng,
      accuracyMeters: pos.accuracy,
      overrideReason: reason,
      note: note || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreviewKind(null);
    setPreviewDistance(null);
    setOverrideReason("");
    setNote("");
    router.refresh();
  }

  async function confirmFarOverride() {
    if (!previewKind || !coords) return;
    if (!overrideReason) {
      setError("จุดเช็กอินห่างจากหมุด — ต้องระบุเหตุผล");
      return;
    }
    await submitCheckIn(previewKind, coords, overrideReason);
  }

  async function onStartTrip() {
    setPending(true);
    setError(null);
    const result = await startTripAction(booking.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const mapsUrl = (lat: number | null, lng: number | null, label: string) => {
    if (lat == null || lng == null) return null;
    return `https://www.google.com/maps?q=${lat},${lng}(${encodeURIComponent(label)})`;
  };

  return (
    <section className="rounded-2xl bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-navy-800">ตำแหน่ง / ความคืบหน้าทริป</h2>
        <span className="rounded-full bg-paper px-2.5 py-1 text-xs text-navy-800">
          {TRIP_PROGRESS_LABEL[progress]}
        </span>
      </div>

      <div className="mt-4 space-y-4 text-sm">
        <LocationBlock
          title="จุดรับ"
          label={booking.pickupLocation}
          address={booking.pickupAddress}
          note={booking.pickupNote}
          mapHref={mapsUrl(booking.pickupLat, booking.pickupLng, booking.pickupLocation)}
        />
        <CheckInSummary title="เช็กอินจุดรับ" checkIn={pickupCi} />
        {booking.actualStartAt ? (
          <p>
            <span className="text-muted">เริ่มงาน</span>{" "}
            <span className="font-medium">{formatClock(booking.actualStartAt)}</span>
          </p>
        ) : null}
        <LocationBlock
          title="จุดส่ง"
          label={booking.dropoffLocation ?? "—"}
          address={booking.dropoffAddress}
          note={booking.dropoffNote}
          mapHref={
            booking.dropoffLocation
              ? mapsUrl(booking.dropoffLat, booking.dropoffLng, booking.dropoffLocation)
              : null
          }
        />
        <CheckInSummary title="เช็กอินจุดส่ง" checkIn={dropoffCi} />
        {booking.actualEndAt ? (
          <p>
            <span className="text-muted">จบงาน</span>{" "}
            <span className="font-medium">{formatClock(booking.actualEndAt)}</span>
          </p>
        ) : null}
      </div>

      {opsReady ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {!pickupCi ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void beginCheckIn("PICKUP")}
              className="h-10 rounded-xl bg-navy-800 px-4 text-sm text-white disabled:opacity-60"
            >
              เช็กอินจุดรับ
            </button>
          ) : null}
          {pickupCi && !booking.actualStartAt ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void onStartTrip()}
              className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60"
            >
              เริ่มงาน
            </button>
          ) : null}
          {booking.actualStartAt && !dropoffCi ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void beginCheckIn("DROPOFF")}
              className="h-10 rounded-xl bg-navy-800 px-4 text-sm text-white disabled:opacity-60"
            >
              เช็กอินจุดส่ง
            </button>
          ) : null}
          {dropoffCi && canCloseout ? (
            <button
              type="button"
              disabled={pending}
              onClick={onOpenCloseout}
              className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60"
            >
              จบงาน
            </button>
          ) : null}
        </div>
      ) : null}

      {previewKind && proximityBand(previewDistance) === "FAR" && coords ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-accent bg-accent/15 p-4">
          <p className="font-medium text-navy-800">
            {proximityLabel("FAR", previewDistance)}
          </p>
          {coords.accuracy != null ? (
            <p className="text-xs text-muted">GPS ±{Math.round(coords.accuracy)} ม.</p>
          ) : null}
          <select
            className="admin-input"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value as LocationOverrideReason | "")}
          >
            <option value="">เลือกเหตุผล</option>
            {LOCATION_OVERRIDE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {LOCATION_OVERRIDE_LABELS[reason]}
              </option>
            ))}
          </select>
          <input
            className="admin-input"
            placeholder="รายละเอียดเพิ่มเติม"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {expectedFor(previewKind) ? (
              <a
                className="inline-flex h-10 items-center rounded-xl border border-line px-3 text-sm"
                href={mapsUrl(
                  expectedFor(previewKind)!.latitude,
                  expectedFor(previewKind)!.longitude,
                  previewKind === "PICKUP" ? booking.pickupLocation : booking.dropoffLocation ?? "",
                )!}
                target="_blank"
                rel="noreferrer"
              >
                เปิดแผนที่
              </a>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => void confirmFarOverride()}
              className="h-10 rounded-xl bg-navy-800 px-4 text-sm text-white disabled:opacity-60"
            >
              เช็กอินต่อพร้อมเหตุผล
            </button>
            <button
              type="button"
              className="h-10 rounded-xl px-3 text-sm text-muted"
              onClick={() => {
                setPreviewKind(null);
                setPreviewDistance(null);
                setCoords(null);
              }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : null}

      {previewKind && proximityBand(previewDistance) === "WARNING" && !pending ? (
        <p className="mt-3 text-xs text-muted">{proximityLabel("WARNING", previewDistance)}</p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <p className="mt-3 text-[11px] text-muted">
        เช็กอินเป็นหลักฐานปฏิบัติการเท่านั้น — ไม่ถือว่าชำระเงินหรือปิดการเงิน
      </p>
    </section>
  );
}

function LocationBlock({
  title,
  label,
  address,
  note,
  mapHref,
}: {
  title: string;
  label: string;
  address: string | null | undefined;
  note: string | null | undefined;
  mapHref: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted">{title}</p>
      <p className="font-medium text-navy-800">{label}</p>
      {address ? <p className="text-xs text-muted">{address}</p> : null}
      {note ? <p className="text-xs">หมายเหตุ: {note}</p> : null}
      {mapHref ? (
        <a href={mapHref} target="_blank" rel="noreferrer" className="text-xs text-navy-800 underline">
          ดูแผนที่
        </a>
      ) : null}
    </div>
  );
}

function CheckInSummary({ title, checkIn }: { title: string; checkIn: TripCheckIn | null }) {
  if (!checkIn) {
    return (
      <p className="text-xs text-muted">
        {title}: ยังไม่เช็กอิน
      </p>
    );
  }
  return (
    <div>
      <p>
        <span className="text-muted">{title}</span>{" "}
        <span className="font-medium">{formatClock(checkIn.checkedAt)}</span>
      </p>
      <p className="text-xs text-muted">
        {proximityLabel(checkIn.proximity, checkIn.distanceFromExpectedM)}
        {checkIn.accuracyMeters != null ? ` · GPS ±${Math.round(checkIn.accuracyMeters)} ม.` : ""}
      </p>
      {checkIn.overrideReason ? (
        <p className="text-xs text-muted">
          เหตุผล override: {LOCATION_OVERRIDE_LABELS[checkIn.overrideReason]}
        </p>
      ) : null}
    </div>
  );
}

function formatClock(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
