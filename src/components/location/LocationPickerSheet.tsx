"use client";

import { useEffect, useState, useTransition } from "react";
import { getLocationProvider, type LocationSuggestion } from "@/lib/location/provider";
import { customerLocationAddress, customerLocationTitle } from "@/lib/location/display";
import type { LocationSource, StructuredLocation } from "@/lib/domain/location";
import { GoogleMapPinPicker } from "@/components/location/GoogleMapPinPicker";

const NOTE_HINTS = ["รอหน้า Lobby", "ประตู 3 ชั้น 1", "หน้าโรงแรม", "โทรก่อนถึง"];
type Props = { open: boolean; title: string; value: StructuredLocation | null; onClose: () => void; onSelect: (next: StructuredLocation) => void };

export function LocationPickerSheet({ open, title, value, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [popular, setPopular] = useState<LocationSuggestion[]>([]);
  const [mapMode, setMapMode] = useState(false);
  const [mapInitial, setMapInitial] = useState<{ lat: number; lng: number } | null>(value?.latitude != null && value?.longitude != null ? { lat: value.latitude, lng: value.longitude } : null);
  const [note, setNote] = useState(value?.customerNote ?? "");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const savedPoint = value?.latitude != null && value?.longitude != null ? { lat: value.latitude, lng: value.longitude } : null;
    setNote(value?.customerNote ?? "");
    setQuery(value?.label ?? "");
    setMapInitial(savedPoint);
    setMapMode(Boolean(savedPoint));
    setGeoError(null);
    void getLocationProvider().popular().then(setPopular).catch(() => setPopular([]));
  }, [open, value]);

  useEffect(() => {
    if (!open || mapMode) return;
    const handle = window.setTimeout(() => startTransition(() => { void getLocationProvider().search(query).then(setSuggestions).catch(() => setSuggestions([])); }), 180);
    return () => window.clearTimeout(handle);
  }, [query, open, mapMode]);

  if (!open) return null;
  function finish(loc: StructuredLocation) { onSelect({ ...loc, customerNote: note.trim() || null }); onClose(); }

  async function previewSuggestion(item: LocationSuggestion, source: LocationSource = "SEARCH") {
    let resolved = item;
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude) || (item.latitude === 0 && item.longitude === 0 && !item.placeId.startsWith("cm-"))) {
      const detail = await getLocationProvider().resolvePlace?.(item.placeId);
      if (detail) resolved = detail;
    }
    if (Number.isFinite(resolved.latitude) && Number.isFinite(resolved.longitude) && !(resolved.latitude === 0 && resolved.longitude === 0)) {
      setMapInitial({ lat: resolved.latitude, lng: resolved.longitude });
      setQuery(resolved.label);
      setMapMode(true);
      return;
    }
    finish({ label: resolved.label, address: resolved.address || null, latitude: null, longitude: null, placeId: resolved.placeId, placeType: resolved.placeType, customerNote: note.trim() || null, source });
  }

  function openCurrentLocation() {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError("อุปกรณ์ไม่รองรับตำแหน่งปัจจุบัน"); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      setMapInitial({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setMapMode(true);
      if (pos.coords.accuracy > 80) setGeoError(`GPS อาจคลาดเคลื่อนประมาณ ${Math.round(pos.coords.accuracy)} ม. กรุณาตรวจหมุดบนแผนที่`);
    }, () => setGeoError("อ่านตำแหน่งปัจจุบันไม่ได้ กรุณาอนุญาต Location หรือปักหมุดเอง"), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  return <div className="fixed inset-0 z-[60]">
    <button type="button" className="absolute inset-0 bg-[color:var(--store-ink,#0F1724)]/45" onClick={onClose} aria-label="ปิด" />
    <div className="absolute inset-x-0 bottom-0 flex max-h-[96dvh] flex-col rounded-t-[1.75rem] bg-[color:var(--store-paper,#F7F4EF)] shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-full md:max-w-xl md:rounded-none">
      <div className="flex items-center justify-between px-5 pb-3 pt-4"><div><p className="text-[11px] font-medium tracking-wide text-muted">เลือกสถานที่</p><h2 className="text-lg font-semibold text-[color:var(--store-ink,#0F1724)]">{title.startsWith("เลือก") ? title : `เลือก${title}`}</h2></div><button type="button" onClick={onClose} className="min-h-11 min-w-11 text-sm text-muted">ปิด</button></div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-6 pt-1">
        {mapMode ? <>
          <button type="button" onClick={() => setMapMode(false)} className="min-h-10 text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)]">← กลับไปค้นหาสถานที่</button>
          <GoogleMapPinPicker key={`${mapInitial?.lat ?? "default"}-${mapInitial?.lng ?? "default"}`} initial={mapInitial} onConfirm={(loc) => finish({ ...loc, customerNote: note.trim() || null })} />
        </> : <>
          <input className="wizard-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสถานที่ โรงแรม สนามบิน หรือชื่อถนน" autoFocus aria-label="ค้นหาสถานที่" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={openCurrentLocation} className="min-h-12 rounded-2xl bg-white px-3 text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)] shadow-sm">◎ ตำแหน่งปัจจุบัน</button>
            <button type="button" onClick={() => setMapMode(true)} className="min-h-12 rounded-2xl bg-white px-3 text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)] shadow-sm">📍 ปักหมุดบนแผนที่</button>
          </div>
          {geoError ? <p className="text-xs text-danger">{geoError}</p> : null}
          {!query.trim() && popular.length ? <div><p className="mb-2 text-xs font-medium text-muted">สถานที่ยอดนิยม</p><SuggestionList items={popular} onPick={(item) => void previewSuggestion(item, "SAVED_PLACE")} /></div> : null}
          {query.trim() ? <SuggestionList items={suggestions} onPick={(item) => void previewSuggestion(item)} /> : null}
          {pending ? <p className="text-xs text-muted">กำลังค้นหา…</p> : null}
          <p className="text-[11px] leading-5 text-muted">เลือกชื่อสถานที่แล้วระบบจะเปิดแผนที่ให้ตรวจหมุดอีกครั้ง คุณสามารถเลื่อนหมุดไปยังประตู อาคาร หรือจุดรับจริงก่อนยืนยัน</p>
        </>}
        <div className="space-y-2"><p className="text-xs font-medium text-muted">หมายเหตุจุดรับ/ส่ง</p><input className="wizard-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น รอหน้า Lobby" /><div className="flex flex-wrap gap-2">{NOTE_HINTS.map((hint) => <button key={hint} type="button" className="min-h-10 rounded-full bg-white px-3 py-1.5 text-[11px] shadow-sm" onClick={() => setNote(hint)}>{hint}</button>)}</div></div>
      </div>
    </div>
  </div>;
}

function SuggestionList({ items, onPick }: { items: LocationSuggestion[]; onPick: (item: LocationSuggestion) => void }) {
  return <ul className="overflow-hidden rounded-2xl bg-white shadow-sm">{items.map((item) => <li key={item.placeId} className="border-b border-[color:var(--store-line,#E8E2D8)] last:border-0"><button type="button" onClick={() => onPick(item)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left"><span className="mt-0.5">📍</span><span><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-muted">{item.address}</span><span className="mt-1 block text-[11px] font-semibold text-[color:var(--store-primary,#0F3D3E)]">ดูและปรับหมุดบนแผนที่ →</span></span></button></li>)}</ul>;
}

export function CompactLocationField({ label, required, value, placeholder, onOpen, onClearNote }: { label: string; required?: boolean; value: StructuredLocation | null; placeholder: string; onOpen: () => void; onClearNote?: () => void }) {
  return <div className="space-y-1.5"><p className="text-[11px] font-medium tracking-wide text-muted">{label}{required ? " *" : ""}</p>{value ? <div className="booking-loc-card"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--store-primary-soft,#E7EFEA)] text-sm" aria-hidden>📍</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[color:var(--store-ink,#0F1724)]">{customerLocationTitle(value)}</p>{customerLocationAddress(value) ? <p className="mt-0.5 text-xs leading-5 text-muted">{customerLocationAddress(value)}</p> : null}{value.customerNote ? <p className="mt-1 text-xs text-[color:var(--store-primary,#0F3D3E)]">หมายเหตุ: {value.customerNote}</p> : null}<div className="mt-2 flex flex-wrap gap-4"><button type="button" onClick={onOpen} className="min-h-11 text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)]">ดู/แก้ไขบนแผนที่</button>{value.customerNote && onClearNote ? <button type="button" onClick={onClearNote} className="min-h-11 text-xs text-muted">ลบหมายเหตุ</button> : null}</div></div></div> : <button type="button" onClick={onOpen} className="booking-loc-card min-h-14"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--store-primary-soft,#E7EFEA)] text-sm" aria-hidden>📍</span><span className="text-sm text-muted">{placeholder}</span></button>}</div>;
}
