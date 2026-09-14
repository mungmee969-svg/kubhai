"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDriverAction, setDriverActiveAction, uploadImageAction } from "@/lib/actions/ops";
import type { Driver } from "@/lib/domain/types";

export function DriverForm({
  businessId,
  driver,
}: {
  businessId: string;
  driver?: Driver;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driverType, setDriverType] = useState(driver?.driverType ?? "INTERNAL");
  const [name, setName] = useState(driver?.name ?? "");
  const [nickname, setNickname] = useState(driver?.nickname ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [lineId, setLineId] = useState(driver?.lineId ?? "");
  const [photoUrl, setPhotoUrl] = useState(driver?.photoUrl ?? "");
  const [licenseNumber, setLicenseNumber] = useState(driver?.licenseNumber ?? "");
  const [active, setActive] = useState(driver?.active ?? true);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const result = await saveDriverAction(businessId, {
      id: driver?.id,
      driverType,
      name,
      nickname: nickname || null,
      phone: phone || null,
      lineId: lineId || null,
      photoUrl: photoUrl || null,
      licenseNumber: licenseNumber || null,
      status: active ? "ACTIVE" : "INACTIVE",
      active,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/store/drivers");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-3xl bg-white p-5">
      <select className="input bg-paper" value={driverType} onChange={(e) => setDriverType(e.target.value as "INTERNAL" | "PARTNER")}>
        <option value="INTERNAL">INTERNAL · คนขับร้าน</option>
        <option value="PARTNER">PARTNER · คนขับพาร์ทเนอร์</option>
      </select>
      <input className="input bg-paper" required placeholder="ชื่อ" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input bg-paper" placeholder="ชื่อเล่น" value={nickname} onChange={(e) => setNickname(e.target.value)} />
      <input className="input bg-paper" placeholder="โทร" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input className="input bg-paper" placeholder="LINE ID" value={lineId} onChange={(e) => setLineId(e.target.value)} />
      <input className="input bg-paper" placeholder="เลขใบขับขี่ (ภายในเท่านั้น)" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
      <label className="block text-sm text-muted">
        รูปคนขับ
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const data = new FormData();
            data.set("file", file);
            data.set("businessId", businessId);
            const result = await uploadImageAction(data);
            if (result.ok && result.data) setPhotoUrl(result.data.url);
          }}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        ใช้งาน
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button disabled={pending} className="h-12 w-full rounded-2xl bg-accent text-navy-950 font-semibold disabled:opacity-60">
        {pending ? "กำลังบันทึก..." : "บันทึกคนขับ"}
      </button>
      {driver ? (
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await setDriverActiveAction(driver.id, !driver.active);
            setPending(false);
            router.refresh();
          }}
          className="h-11 w-full rounded-2xl bg-paper text-sm"
        >
          {driver.active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
        </button>
      ) : null}
    </form>
  );
}
