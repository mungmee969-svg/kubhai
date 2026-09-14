"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveBusinessProfileAction, saveFaqAction, saveOpsSettingsAction, uploadImageAction } from "@/lib/actions/ops";
import { SERVICE_TYPE_LABELS } from "@/lib/domain/enums";
import type { Business, BusinessSettings, FaqItem, PaymentAccount, Province, Region, StaffMember, StoreOpsConfig } from "@/lib/domain/types";
import { PaymentAccountsPanel } from "./settings/PaymentAccountsPanel";
import { StaffManagementPanel } from "./StaffManagementPanel";
import { StoreTipsSettingsPanel } from "./StoreTipsSettingsPanel";
import { BookingAppearancePanel } from "./BookingAppearancePanel";
import { StorefrontLinkActions } from "./shell/StorefrontLinkActions";
import { Feedback } from "./ui/Feedback";

const TABS = [
  ["store", "ร้านค้า"],
  ["brand", "แบรนด์ร้าน"],
  ["appearance", "รูปลักษณ์"],
  ["booking", "การจอง"],
  ["tips", "คำแนะนำร้าน"],
  ["pricing", "ราคา/บริการ"],
  ["payment", "การชำระเงิน"],
  ["faq", "FAQ"],
  ["terms", "เงื่อนไข"],
  ["docs", "เอกสาร"],
  ["staff", "พนักงาน"],
] as const;

const FAQ_STARTER: FaqItem[] = [
  { question: "ค่าน้ำมันรวมไหม", answer: "" },
  { question: "ค่าที่จอดรถ", answer: "" },
  { question: "ค่าทางด่วนรวมไหม", answer: "" },
  { question: "ชั่วโมงเกินคิดอย่างไร", answer: "" },
  { question: "ยกเลิกได้ไหม", answer: "" },
  { question: "กระเป๋าได้กี่ใบ", answer: "" },
  { question: "มี Child Seat หรือไม่", answer: "" },
  { question: "รวม / ไม่รวมอะไรบ้าง", answer: "" },
];

export function SettingsForm({
  businessId,
  business,
  settings,
  staff,
  accounts,
  tab,
  canManageStaff = false,
  province = null,
  region = null,
}: {
  businessId: string;
  business: Business;
  settings: BusinessSettings | null;
  staff: StaffMember[];
  accounts: PaymentAccount[];
  tab: string;
  canManageStaff?: boolean;
  province?: Province | null;
  region?: Region | null;
}) {
  const router = useRouter();
  const ops = settings?.ops;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [name, setName] = useState(business.name);
  const [logoUrl, setLogoUrl] = useState(business.logoUrl ?? "");
  const [coverUrl, setCoverUrl] = useState(business.coverUrl ?? "");
  const [description, setDescription] = useState(business.description ?? "");
  const [phone, setPhone] = useState(business.phone ?? "");
  const [lineUrl, setLineUrl] = useState(business.lineUrl ?? "");
  const [facebookUrl, setFacebookUrl] = useState(business.facebookUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(business.instagramUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(business.websiteUrl ?? "");
  const [email, setEmail] = useState(business.email ?? "");
  const [address, setAddress] = useState(business.address ?? "");
  const [bookingNotes, setBookingNotes] = useState(settings?.bookingNotes ?? "");
  const [faq, setFaq] = useState<FaqItem[]>(settings?.faq?.length ? settings.faq : FAQ_STARTER);
  const [minAdvanceHours, setMinAdvanceHours] = useState(ops?.minAdvanceHours ? String(ops.minAdvanceHours) : "");
  const [serviceHours, setServiceHours] = useState(ops?.serviceHours ?? "");
  const [cancellationPolicy, setCancellationPolicy] = useState(ops?.cancellationPolicy ?? "");
  const [customerInstructions, setCustomerInstructions] = useState(ops?.customerInstructions ?? "");
  const [overtimeNote, setOvertimeNote] = useState(ops?.overtimeNote ?? "");
  const [includedHoursPerDay, setIncludedHoursPerDay] = useState(
    ops?.includedHoursPerDay != null ? String(ops.includedHoursPerDay) : "",
  );
  const [overtimeRatePerHour, setOvertimeRatePerHour] = useState(
    ops?.overtimeRatePerHour != null ? String(ops.overtimeRatePerHour) : "",
  );
  const [bankName] = useState(ops?.bankName ?? "");
  const [bankAccountName] = useState(ops?.bankAccountName ?? "");
  const [bankAccountNumber] = useState(ops?.bankAccountNumber ?? "");
  const [promptpay] = useState(ops?.promptpay ?? "");
  const [quotationPrefix, setQuotationPrefix] = useState(ops?.quotationPrefix ?? "QT");
  const [taxInvoiceName, setTaxInvoiceName] = useState(ops?.taxInvoiceName ?? "");
  const [taxId, setTaxId] = useState(ops?.taxId ?? "");
  const [deposit, setDeposit] = useState(settings?.defaultDepositPercent ? String(settings.defaultDepositPercent) : "");
  const [shortName, setShortName] = useState(business.shortName ?? "");
  const [primaryColor, setPrimaryColor] = useState(business.primaryColor ?? "#0F3D3E");
  const [secondaryColor, setSecondaryColor] = useState(business.secondaryColor ?? "#E8F0EF");
  const [accentColor, setAccentColor] = useState(business.accentColor ?? "#C4A35A");
  const [backgroundColor, setBackgroundColor] = useState(business.backgroundColor ?? "#F7F3EA");
  const [customerSupportText, setCustomerSupportText] = useState(business.customerSupportText ?? "");
  const [poweredBy, setPoweredBy] = useState(business.poweredByKubHaiEnabled !== false);

  async function upload(kind: "logo" | "cover", file: File) {
    const data = new FormData();
    data.set("file", file);
    data.set("businessId", businessId);
    const result = await uploadImageAction(data);
    if (result.ok && result.data) {
      if (kind === "logo") setLogoUrl(result.data.url);
      else setCoverUrl(result.data.url);
    } else if (!result.ok) setError(result.error);
  }

  function opsPayload(): StoreOpsConfig & { defaultDepositPercent: number | null } {
    return {
      minAdvanceHours: minAdvanceHours ? Number(minAdvanceHours) : null,
      serviceHours: serviceHours || null,
      cancellationPolicy: cancellationPolicy || null,
      customerInstructions: customerInstructions || null,
      overtimeNote: overtimeNote || null,
      includedHoursPerDay: includedHoursPerDay ? Number(includedHoursPerDay) : null,
      overtimeRatePerHour: overtimeRatePerHour ? Number(overtimeRatePerHour) : null,
      bankName: bankName || null,
      bankAccountName: bankAccountName || null,
      bankAccountNumber: bankAccountNumber || null,
      promptpay: promptpay || null,
      quotationPrefix: quotationPrefix || null,
      taxInvoiceName: taxInvoiceName || null,
      taxId: taxId || null,
      defaultDepositPercent: deposit ? Number(deposit) : null,
    };
  }

  async function saveProfile() {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await saveBusinessProfileAction(businessId, {
      name,
      shortName: shortName || null,
      logoUrl: logoUrl || null,
      coverUrl: coverUrl || null,
      description,
      phone,
      lineUrl,
      facebookUrl,
      instagramUrl,
      websiteUrl,
      email,
      address,
      primaryColor: primaryColor || null,
      secondaryColor: secondaryColor || null,
      accentColor: accentColor || null,
      backgroundColor: backgroundColor || null,
      customerSupportText: customerSupportText || null,
      poweredByKubHaiEnabled: poweredBy,
    });
    setPending(false);
    if (!result.ok) setError(result.error);
    else {
      setSuccess("บันทึกข้อมูลร้านแล้ว");
      router.refresh();
    }
  }

  async function saveOps() {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await saveOpsSettingsAction(businessId, opsPayload());
    setPending(false);
    if (!result.ok) setError(result.error);
    else {
      setSuccess("บันทึกตั้งค่าแล้ว");
      router.refresh();
    }
  }

  async function saveFaq() {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await saveFaqAction(businessId, faq, bookingNotes || null);
    setPending(false);
    if (!result.ok) setError(result.error);
    else {
      setSuccess("บันทึก FAQ แล้ว");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/store/settings?tab=${key}`}
            className={`rounded-full px-3 py-2 text-sm ${tab === key ? "bg-navy-800 text-white" : "bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <Feedback error={error} success={success} />

      {tab === "store" ? (
        <section className="space-y-3 rounded-2xl bg-white p-5">
          <StorefrontLinkActions slug={business.slug} variant="settings" />
          <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="admin-input min-h-24 py-3" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="admin-input" placeholder="โทร" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="admin-input" placeholder="LINE URL" value={lineUrl} onChange={(e) => setLineUrl(e.target.value)} />
          <input className="admin-input" placeholder="Facebook URL" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} />
          <input className="admin-input" placeholder="Instagram URL" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} />
          <input className="admin-input" placeholder="Website" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
          <input className="admin-input" placeholder="อีเมล" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="admin-input" placeholder="ที่อยู่ / จังหวัด" value={address} onChange={(e) => setAddress(e.target.value)} />
          <label className="block text-sm text-muted">
            โลโก้
            <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload("logo", file);
            }} />
          </label>
          <label className="block text-sm text-muted">
            รูปปก
            <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload("cover", file);
            }} />
          </label>
          <button type="button" disabled={pending} onClick={() => void saveProfile()} className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60">
            บันทึกข้อมูลร้าน
          </button>
        </section>
      ) : null}

      {tab === "brand" ? (
        <section className="space-y-4 rounded-2xl bg-white p-5">
          <h2 className="font-semibold text-navy-800">แบรนด์ร้าน</h2>
          <input
            className="admin-input"
            placeholder="ชื่อสั้น"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-muted">
              สีหลัก
              <input type="color" className="mt-1 block h-10 w-full" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            </label>
            <label className="text-sm text-muted">
              สีรอง
              <input type="color" className="mt-1 block h-10 w-full" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
            </label>
            <label className="text-sm text-muted">
              สีเน้น
              <input type="color" className="mt-1 block h-10 w-full" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
            </label>
            <label className="text-sm text-muted">
              พื้นหลัง
              <input type="color" className="mt-1 block h-10 w-full" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
            </label>
          </div>
          <textarea
            className="admin-input min-h-20 py-3"
            placeholder="ข้อความช่วยเหลือลูกค้า"
            value={customerSupportText}
            onChange={(e) => setCustomerSupportText(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={poweredBy} onChange={(e) => setPoweredBy(e.target.checked)} />
            แสดง Powered by KubHai
          </label>
          <label className="block text-sm text-muted">
            โลโก้
            <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload("logo", file);
            }} />
          </label>

          <div
            className="overflow-hidden rounded-2xl border border-line"
            style={{
              background: backgroundColor,
              ["--store-primary" as string]: primaryColor,
              ["--store-accent" as string]: accentColor,
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: primaryColor }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-9 w-9 rounded-[22%] bg-white object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-[22%] bg-white/20 text-sm font-bold">
                  {(shortName || name).slice(0, 1)}
                </div>
              )}
              <p className="text-sm font-semibold">{name}</p>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm font-medium" style={{ color: primaryColor }}>
                ตัวอย่างหน้าลูกค้า
              </p>
              <button
                type="button"
                className="h-10 w-full rounded-xl text-sm font-semibold"
                style={{ background: accentColor, color: primaryColor }}
              >
                เริ่มจองรถ
              </button>
              <button type="button" className="h-10 w-full rounded-xl border text-sm" style={{ borderColor: primaryColor, color: primaryColor }}>
                ดูการจองของฉัน
              </button>
              <div className="rounded-xl bg-white p-3 text-sm shadow-sm">
                <p className="font-medium">ตัวอย่างการ์ดจอง</p>
                <p className="mt-1 text-xs text-muted">รถพร้อมคนขับ · ส่งคำขอจอง</p>
              </div>
            </div>
          </div>

          <button type="button" disabled={pending} onClick={() => void saveProfile()} className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60">
            บันทึกแบรนด์
          </button>
        </section>
      ) : null}

      {tab === "appearance" ? (
        <BookingAppearancePanel
          businessId={businessId}
          business={business}
          province={province}
          region={region}
        />
      ) : null}

      {tab === "booking" ? (
        <section className="space-y-3 rounded-2xl bg-white p-5">
          <input className="admin-input" placeholder="จองล่วงหน้าอย่างน้อย (ชั่วโมง)" value={minAdvanceHours} onChange={(e) => setMinAdvanceHours(e.target.value)} />
          <input className="admin-input" placeholder="เวลาให้บริการ เช่น 07:00-20:00" value={serviceHours} onChange={(e) => setServiceHours(e.target.value)} />
          <textarea className="admin-input min-h-24 py-3" placeholder="กฎการจอง / โน้ตถึงลูกค้า" value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} />
          <textarea className="admin-input min-h-24 py-3" placeholder="คำแนะนำลูกค้า" value={customerInstructions} onChange={(e) => setCustomerInstructions(e.target.value)} />
          <textarea className="admin-input min-h-24 py-3" placeholder="นโยบายยกเลิก" value={cancellationPolicy} onChange={(e) => setCancellationPolicy(e.target.value)} />
          <button type="button" disabled={pending} onClick={() => void Promise.all([saveFaq(), saveOps()])} className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60">
            บันทึกการจอง
          </button>
        </section>
      ) : null}

      {tab === "tips" ? (
        <StoreTipsSettingsPanel businessId={businessId} initialTips={settings?.tips ?? []} />
      ) : null}

      {tab === "pricing" ? (
        <section className="space-y-3 rounded-2xl bg-white p-5">
          <p className="text-sm text-muted">ประเภทบริการที่ระบบรองรับ</p>
          <ul className="text-sm">
            {Object.values(SERVICE_TYPE_LABELS).map((label) => (
              <li key={label}>• {label}</li>
            ))}
          </ul>
          <textarea className="admin-input min-h-24 py-3" placeholder="ชั่วโมงเกิน / overtime" value={overtimeNote} onChange={(e) => setOvertimeNote(e.target.value)} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">ชั่วโมงรวม / วัน (ค่าเริ่มต้นใบเสนอราคา)</span>
              <input
                className="admin-input"
                inputMode="decimal"
                placeholder="เช่น 8"
                value={includedHoursPerDay}
                onChange={(e) => setIncludedHoursPerDay(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">OT บาท / ชม. (เงื่อนไข — ไม่ใช่ยอดเรียกเก็บทันที)</span>
              <input
                className="admin-input"
                inputMode="decimal"
                placeholder="เช่น 200"
                value={overtimeRatePerHour}
                onChange={(e) => setOvertimeRatePerHour(e.target.value)}
              />
            </label>
          </div>
          <button type="button" disabled={pending} onClick={() => void saveOps()} className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60">
            บันทึกราคา/บริการ
          </button>
        </section>
      ) : null}

      {tab === "payment" ? (
        <section className="space-y-4 rounded-2xl bg-white p-5">
          <div>
            <p className="text-sm text-muted">% มัดจำเริ่มต้นของร้าน</p>
            <input className="admin-input mt-2" placeholder="% มัดจำ" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            <button type="button" disabled={pending} onClick={() => void saveOps()} className="mt-3 h-11 rounded-xl bg-navy-800 px-4 text-sm text-white disabled:opacity-60">
              บันทึก % มัดจำ
            </button>
          </div>
          <PaymentAccountsPanel businessId={businessId} accounts={accounts} />
        </section>
      ) : null}

      {tab === "faq" ? (
        <section className="space-y-3 rounded-2xl bg-white p-5">
          {faq.map((item, index) => (
            <div key={`${item.question}-${index}`} className="space-y-2 rounded-xl bg-paper p-3">
              <input
                className="admin-input"
                value={item.question}
                onChange={(e) =>
                  setFaq((current) => current.map((row, i) => (i === index ? { ...row, question: e.target.value } : row)))
                }
              />
              <textarea
                className="admin-input min-h-20 py-3"
                value={item.answer}
                onChange={(e) =>
                  setFaq((current) => current.map((row, i) => (i === index ? { ...row, answer: e.target.value } : row)))
                }
              />
            </div>
          ))}
          <button type="button" disabled={pending} onClick={() => void saveFaq()} className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60">
            บันทึก FAQ
          </button>
        </section>
      ) : null}

      {tab === "terms" ? (
        <section className="space-y-3 rounded-2xl bg-white p-5">
          <textarea className="admin-input min-h-28 py-3" placeholder="เงื่อนไข / นโยบายยกเลิก" value={cancellationPolicy} onChange={(e) => setCancellationPolicy(e.target.value)} />
          <textarea className="admin-input min-h-28 py-3" placeholder="คำแนะนำลูกค้า" value={customerInstructions} onChange={(e) => setCustomerInstructions(e.target.value)} />
          <button type="button" disabled={pending} onClick={() => void saveOps()} className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60">
            บันทึกเงื่อนไข
          </button>
        </section>
      ) : null}

      {tab === "docs" ? (
        <section className="space-y-3 rounded-2xl bg-white p-5">
          <input className="admin-input" placeholder="คำนำหน้าใบเสนอราคา" value={quotationPrefix} onChange={(e) => setQuotationPrefix(e.target.value)} />
          <input className="admin-input" placeholder="ชื่อออกใบกำกับภาษี" value={taxInvoiceName} onChange={(e) => setTaxInvoiceName(e.target.value)} />
          <input className="admin-input" placeholder="เลขประจำตัวผู้เสียภาษี" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          <button type="button" disabled={pending} onClick={() => void saveOps()} className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60">
            บันทึกเอกสาร
          </button>
        </section>
      ) : null}

      {tab === "staff" ? (
        <StaffManagementPanel businessId={businessId} staff={staff} canManage={canManageStaff} />
      ) : null}
    </div>
  );
}
