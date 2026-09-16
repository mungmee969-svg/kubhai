"use client";

import { useEffect, useRef, useState } from "react";
import type { StructuredLocation } from "@/lib/domain/location";

type LatLng = { lat: number; lng: number };
type MapsEvent = { addListener: (name: string, fn: () => void) => void };
type MapLike = MapsEvent & { getCenter: () => { lat: () => number; lng: () => number } | null; panTo: (p: LatLng) => void };
type MarkerLike = MapsEvent & { getPosition: () => { lat: () => number; lng: () => number } | null; setPosition: (p: LatLng) => void };
type GeocoderResult = { formatted_address?: string; place_id?: string; types?: string[] };
type GoogleMapsApi = {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => MapLike;
  Marker: new (options: Record<string, unknown>) => MarkerLike;
  Geocoder: new () => { geocode: (request: { location: LatLng }, cb: (results: GeocoderResult[] | null, status: string) => void) => void };
};
type GoogleWindow = Window & { google?: { maps?: GoogleMapsApi } };

let loader: Promise<GoogleMapsApi> | null = null;
function loadMaps(): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  const existing = (window as GoogleWindow).google?.maps;
  if (existing) return Promise.resolve(existing);
  if (loader) return loader;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return Promise.reject(new Error("Google Maps key missing"));
  loader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=th&region=TH`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const maps = (window as GoogleWindow).google?.maps;
      if (maps) resolve(maps); else reject(new Error("Google Maps unavailable"));
    };
    script.onerror = () => reject(new Error("โหลด Google Maps ไม่สำเร็จ"));
    document.head.appendChild(script);
  });
  return loader;
}

function firstAddressLine(value: string) {
  return value.split(",")[0]?.trim() || value.trim();
}

export function GoogleMapPinPicker({ initial, onConfirm }: { initial?: LatLng | null; onConfirm: (loc: StructuredLocation) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLike | null>(null);
  const markerRef = useRef<MarkerLike | null>(null);
  const mapsRef = useRef<GoogleMapsApi | null>(null);
  const [point, setPoint] = useState<LatLng>(initial ?? { lat: 18.7883, lng: 98.9853 });
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function describe(p: LatLng) {
    const maps = mapsRef.current;
    if (!maps) return;
    setGeocoding(true);
    new maps.Geocoder().geocode({ location: p }, (results, status) => {
      const readable = status === "OK" ? results?.[0]?.formatted_address?.trim() : "";
      setAddress(readable || null);
      setGeocoding(false);
      if (!readable) setError("ยังอ่านชื่อ/ที่อยู่ของหมุดนี้ไม่ได้ กรุณาขยับหมุดเล็กน้อยแล้วลองใหม่");
      else setError((current) => current?.startsWith("GPS อาจคลาดเคลื่อน") ? current : null);
    });
  }

  useEffect(() => {
    let alive = true;
    void loadMaps().then((maps) => {
      if (!alive || !hostRef.current) return;
      mapsRef.current = maps;
      const center = initial ?? point;
      const map = new maps.Map(hostRef.current, { center, zoom: 17, streetViewControl: false, mapTypeControl: false, fullscreenControl: false, clickableIcons: true });
      const marker = new maps.Marker({ position: center, map, draggable: true, title: "จุดที่เลือก" });
      mapRef.current = map;
      markerRef.current = marker;
      marker.addListener("dragend", () => {
        const p = marker.getPosition();
        if (!p) return;
        const next = { lat: p.lat(), lng: p.lng() };
        setPoint(next); map.panTo(next); describe(next);
      });
      map.addListener("idle", () => {
        const c = map.getCenter();
        if (!c) return;
        const next = { lat: c.lat(), lng: c.lng() };
        marker.setPosition(next); setPoint(next); describe(next);
      });
      setBusy(false); describe(center);
    }).catch((e: unknown) => { if (alive) { setBusy(false); setError(e instanceof Error ? e.message : "โหลดแผนที่ไม่สำเร็จ"); } });
    return () => { alive = false; };
  }, []);

  function currentLocation() {
    setError(null);
    if (!navigator.geolocation) { setError("อุปกรณ์ไม่รองรับตำแหน่งปัจจุบัน"); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setPoint(next); mapRef.current?.panTo(next); markerRef.current?.setPosition(next); describe(next);
      if (pos.coords.accuracy > 80) setError(`GPS อาจคลาดเคลื่อนประมาณ ${Math.round(pos.coords.accuracy)} ม. กรุณาตรวจหมุดก่อนยืนยัน`);
    }, () => setError("อ่านตำแหน่งปัจจุบันไม่ได้ กรุณาอนุญาต Location หรือเลื่อนหมุดเอง"), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  function confirm() {
    const maps = mapsRef.current;
    if (!maps || geocoding) return;
    setGeocoding(true);
    new maps.Geocoder().geocode({ location: point }, (results, status) => {
      setGeocoding(false);
      const hit = status === "OK" ? results?.[0] : undefined;
      const readable = hit?.formatted_address?.trim();
      if (!readable) {
        setAddress(null);
        setError("ยังระบุที่อยู่ของจุดนี้ไม่ได้ กรุณาขยับหมุดหรือค้นหาสถานที่ใหม่ก่อนยืนยัน");
        return;
      }
      setAddress(readable);
      setError(null);
      onConfirm({ label: firstAddressLine(readable), address: readable, latitude: point.lat, longitude: point.lng, placeId: hit?.place_id || null, placeType: hit?.types?.[0] || "map_pin", customerNote: null, source: "MAP_PIN" });
    });
  }

  return <div className="space-y-3">
    <div className="relative overflow-hidden rounded-2xl border border-[color:var(--store-line,#E8E2D8)] bg-white">
      <div ref={hostRef} className="h-[48dvh] min-h-[320px] w-full" aria-label="แผนที่เลือกตำแหน่ง" />
      {busy ? <div className="absolute inset-0 grid place-items-center bg-white/80 text-sm">กำลังโหลดแผนที่…</div> : null}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-4xl drop-shadow">📍</div>
      <button type="button" onClick={currentLocation} className="absolute bottom-4 right-4 min-h-11 rounded-full bg-white px-4 text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)] shadow-lg">◎ ตำแหน่งปัจจุบัน</button>
    </div>
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold">ตำแหน่งที่เลือก</p>
      <p className="mt-1 text-xs leading-5 text-muted">{geocoding ? "กำลังค้นหาชื่อและที่อยู่…" : address || "ยังไม่มีรายละเอียดที่อยู่"}</p>
    </div>
    {error ? <p className="text-xs text-danger">{error}</p> : null}
    <button type="button" disabled={busy || geocoding || !address} onClick={confirm} className="booking-cta-primary">{geocoding ? "กำลังตรวจสอบที่อยู่…" : "ยืนยันตำแหน่งนี้"}</button>
  </div>;
}
