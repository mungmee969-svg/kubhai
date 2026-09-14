import type { Metadata } from "next";
import {
  PoweredByKubHaiSubtle,
  StoreBrandScope,
  StoreLogo,
} from "@/components/brand/StoreBrand";
import { brandingMetadata } from "@/components/brand/CustomerStoreChrome";
import { DriverJobClient } from "@/components/driver/DriverJobClient";
import { getStore } from "@/lib/data";
import {
  buildDayShell,
  dayRelativeLabel,
  mapsUrlForItem,
} from "@/lib/domain/driver-job";
import { resolveBusinessBranding } from "@/lib/domain/branding";
import { formatThaiDate } from "@/lib/domain/ops";
import { groupItineraryByDay, kindLabel } from "@/lib/booking/itinerary";
import type { BookingItineraryItem } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  if (!token || token.length < 20) return { title: "งานคนขับ" };
  const record = await getStore().getDriverJobByToken(token);
  if (!record) return { title: "งานคนขับ" };
  return brandingMetadata(record.business, "งานคนขับ");
}

export default async function DriverJobPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 20) {
    return <InvalidJobPage />;
  }

  const record = await getStore().openDriverJob(token);
  if (!record) {
    return <InvalidJobPage />;
  }

  const brand = resolveBusinessBranding(record.business);
  const shell = buildDayShell(record.booking);
  const dayLogsByNumber = new Map(record.dayLogs.map((item) => [item.dayNumber, item]));
  const days = shell.map((day) => ({
    dayNumber: day.dayNumber,
    dayDate: formatThaiDate(day.dayDate),
    relativeLabel: dayRelativeLabel(day.dayDate),
    log: dayLogsByNumber.get(day.dayNumber) ?? null,
  }));

  const tripItems = record.itinerary.filter((item) => (item.dayNumber ?? 0) > 0);
  const grouped = groupItineraryByDay(tripItems);

  return (
    <StoreBrandScope brand={brand} className="min-h-dvh bg-store-paper">
      <header className="bg-store text-white">
        <div className="mx-auto max-w-lg px-5 py-6">
          <div className="flex items-center gap-3">
            <StoreLogo brand={brand} size={40} className="bg-white" />
            <div>
              <p className="text-xs text-white/70">{brand.businessName}</p>
              <h1 className="text-xl font-semibold">งานคนขับ</h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/85">
            {record.booking.bookingCode}
            {record.driver ? ` · ${record.driver.name}` : ""}
          </p>
          {record.vehicle ? (
            <p className="mt-1 text-xs text-white/70">
              {record.vehicle.brand} {record.vehicle.model}
              {record.vehicle.plateNumber ? ` · ${record.vehicle.plateNumber}` : ""}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-5 py-5 pb-16">
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          แผนทริปอาจมีการเปลี่ยนแปลง — ดูรายการล่าสุดด้านล่างก่อนออกเดินทาง
        </p>

        <DriverJobClient token={token} days={days} />

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-[color:var(--store-text,#0F172A)]">แผนรายวัน</h2>
          <p className="mt-1 text-xs text-muted">อัปเดตสดจากร้าน · ไม่ใช่สำเนาเก่า</p>
          {shell.length === 0 ? (
            <p className="mt-3 text-sm text-muted">ยังไม่มีแผน</p>
          ) : (
            <div className="mt-3 space-y-3">
              {shell.map((day) => {
                const items = grouped.get(day.dayNumber) ?? [];
                return (
                  <div key={day.dayNumber} className="rounded-xl bg-paper px-3 py-3">
                    <p className="text-sm font-semibold">
                      วันที่ {day.dayNumber}
                      <span className="ml-2 text-xs font-normal text-muted">
                        {formatThaiDate(day.dayDate)}
                      </span>
                    </p>
                    {items.length === 0 ? (
                      <p className="mt-2 text-sm text-muted">ยังไม่มีจุดในวันนี้</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {items.map((item) => (
                          <ItineraryStop key={item.id} item={item} />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {record.notes.length > 0 ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold">หมายเหตุจากร้าน</h2>
            <ul className="mt-2 space-y-2">
              {record.notes.map((note) => (
                <li key={note.id} className="rounded-xl bg-paper px-3 py-2 text-sm">
                  {note.title ? <p className="text-xs font-medium text-muted">{note.title}</p> : null}
                  <p className={note.title ? "mt-0.5" : ""}>{note.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="pt-2">
          <PoweredByKubHaiSubtle enabled={brand.poweredByKubHaiEnabled} />
        </div>
      </main>
    </StoreBrandScope>
  );
}

function ItineraryStop({ item }: { item: BookingItineraryItem }) {
  const maps = mapsUrlForItem(item);
  return (
    <li className="text-sm">
      <span className="text-xs text-muted">{kindLabel(item.kind)} · </span>
      {item.title}
      {item.address || item.location ? (
        <span className="mt-0.5 block text-xs text-muted">{item.address || item.location}</span>
      ) : null}
      {item.note ? <span className="mt-0.5 block text-xs text-muted">{item.note}</span> : null}
      {maps ? (
        <a
          href={maps}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs font-medium text-[color:var(--store-primary,#0F3D3E)] underline"
        >
          เปิดแผนที่
        </a>
      ) : null}
    </li>
  );
}

function InvalidJobPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-6">
      <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-navy-800">ลิงก์งานไม่พร้อมใช้งาน</h1>
        <p className="mt-2 text-sm text-muted">
          ลิงก์อาจหมดอายุ ถูกยกเลิก หรือพิมพ์ผิด — ติดต่อร้านเพื่อขอลิงก์ใหม่
        </p>
      </div>
    </div>
  );
}
