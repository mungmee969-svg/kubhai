import Image from "next/image";
import Link from "next/link";
import { PlatformAdminShell } from "@/components/admin/PlatformAdminShell";
import {
  publishHomepageDraftAction,
  saveHomepageDraftAction,
} from "@/lib/actions/homepage";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import {
  HOMEPAGE_CATEGORY_IDS,
  HOMEPAGE_SECTION_IDS,
  type HomepageCategoryId,
  type HomepageSectionId,
} from "@/lib/domain/homepage-cms";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-navy-950/55 px-3 text-sm text-white outline-none focus:border-accent";
const textareaClass =
  "mt-1.5 min-h-24 w-full rounded-xl border border-white/10 bg-navy-950/55 px-3 py-2.5 text-sm text-white outline-none focus:border-accent";
const sectionLabel: Record<HomepageSectionId, string> = {
  categories: "หมวดหมู่",
  recommended: "รายการแนะนำ",
  agents: "ร้านรถแนะนำ",
};
const categoryLabel: Record<HomepageCategoryId, string> = {
  attractions: "ที่เที่ยว",
  restaurants: "ร้านอาหาร",
  cafes: "คาเฟ่",
  transport: "รถเช่า / บริการรถ",
};

export default async function AdminWebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; published?: string; error?: string }>;
}) {
  const ctx = await requirePlatformAdmin();
  const [workspace, businesses, query] = await Promise.all([
    ctx.store.getHomepageWorkspace(ctx.actor),
    ctx.store.listBusinesses(ctx.actor),
    searchParams,
  ]);
  const draft = workspace.draft;
  const places = await ctx.store.listPublicPlaces({
    provinceSlug: draft.search.defaultAreaSlug,
  });
  const activeBusinesses = businesses.filter((business) => business.status === "ACTIVE");
  const businessById = new Map(
    activeBusinesses.map((business) => [business.id, business]),
  );

  return (
    <PlatformAdminShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Platform Website</p>
          <h1 className="mt-1 text-2xl font-semibold">จัดการเว็บไซต์</h1>
          <p className="mt-2 text-sm text-white/60">
            แก้เนื้อหาภายในโครงหน้าแรกที่อนุมัติแล้ว โดยไม่เปลี่ยนระบบค้นหา Place หรือหน้าร้าน
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/website/preview"
            target="_blank"
            className="inline-flex h-11 items-center rounded-xl bg-white/10 px-4 text-sm font-semibold"
          >
            ดูตัวอย่างฉบับร่าง
          </Link>
          <form action={publishHomepageDraftAction}>
            <button className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950">
              เผยแพร่
            </button>
          </form>
        </div>
      </div>

      <section className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white/5 p-4 text-sm">
        <span
          className={`rounded-full px-3 py-1.5 font-semibold ${
            workspace.hasUnpublishedChanges
              ? "bg-amber-300/15 text-amber-200"
              : "bg-emerald-300/15 text-emerald-200"
          }`}
        >
          {workspace.hasUnpublishedChanges ? "มีฉบับร่างที่ยังไม่เผยแพร่" : "เผยแพร่แล้ว"}
        </span>
        <span className="text-white/55">
          เผยแพร่ล่าสุด:{" "}
          {workspace.publishedAt
            ? new Date(workspace.publishedAt).toLocaleString("th-TH")
            : "ใช้ค่าเริ่มต้นของระบบ"}
        </span>
      </section>

      {query.saved ? (
        <p className="mt-4 rounded-xl bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
          บันทึกร่างแล้ว หน้าเว็บสาธารณะยังไม่เปลี่ยนจนกว่าจะกดเผยแพร่
        </p>
      ) : null}
      {query.published ? (
        <p className="mt-4 rounded-xl bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
          เผยแพร่หน้าแรกเรียบร้อยแล้ว
        </p>
      ) : null}
      {query.error ? (
        <p className="mt-4 rounded-xl bg-red-300/10 px-4 py-3 text-sm text-red-100">
          {query.error}
        </p>
      ) : null}

      <form action={saveHomepageDraftAction} className="mt-6 space-y-5">
        <EditorCard title="Hero" description="ภาพและข้อความหลักด้านบนของหน้าแรก">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hero.enabled" defaultChecked={draft.hero.enabled} />
            แสดงข้อความ Hero
          </label>
          <ImagePreview src={draft.hero.imageUrl} alt="ภาพ Hero ปัจจุบัน" wide />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ป้ายข้อความเล็ก" name="hero.eyebrow" value={draft.hero.eyebrow} />
            <Field label="พาธรูป Hero" name="hero.imageUrl" value={draft.hero.imageUrl} />
          </div>
          <TextArea
            label="หัวเรื่อง (ขึ้นบรรทัดใหม่ได้)"
            name="hero.headline"
            value={draft.hero.headline}
          />
          <TextArea
            label="คำอธิบาย (ขึ้นบรรทัดใหม่ได้)"
            name="hero.description"
            value={draft.hero.description}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <CtaFields
              prefix="hero.primaryCta"
              title="ปุ่มหลัก"
              enabled={draft.hero.primaryCtaEnabled}
              label={draft.hero.primaryCtaLabel}
              href={draft.hero.primaryCtaHref}
            />
            <CtaFields
              prefix="hero.secondaryCta"
              title="ปุ่มรอง"
              enabled={draft.hero.secondaryCtaEnabled}
              label={draft.hero.secondaryCtaLabel}
              href={draft.hero.secondaryCtaHref}
            />
          </div>
        </EditorCard>

        <EditorCard title="การค้นหา" description="เปลี่ยนเฉพาะข้อความ ระบบค้นหายังใช้หน้า Places เดิม">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="search.enabled" defaultChecked={draft.search.enabled} />
            แสดงการค้นหา
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="หัวข้อช่องค้นหา" name="search.heading" value={draft.search.heading} />
            <Field label="ข้อความตัวอย่าง" name="search.placeholder" value={draft.search.placeholder} />
            <Field
              label="ชื่อพื้นที่เริ่มต้น"
              name="search.defaultAreaLabel"
              value={draft.search.defaultAreaLabel}
            />
            <Field
              label="Slug พื้นที่"
              name="search.defaultAreaSlug"
              value={draft.search.defaultAreaSlug}
            />
          </div>
          <TextArea
            label="คำค้นยอดนิยม — หนึ่งรายการต่อบรรทัด (ชื่อ|คำค้น)"
            name="search.popularSearches"
            value={draft.search.popularSearches
              .map((item) => `${item.label}|${item.query}`)
              .join("\n")}
          />
        </EditorCard>

        <EditorCard title="หมวดหมู่หน้าแรก" description="แก้ภาพ ข้อความ ลิงก์ และลำดับของ 4 หมวดที่รองรับ">
          <div className="grid gap-4 lg:grid-cols-2">
            {draft.categories.map((category, index) => (
              <article key={category.id} className="rounded-2xl bg-navy-950/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{categoryLabel[category.id]}</p>
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      name={`category.${category.id}.enabled`}
                      defaultChecked={category.enabled}
                    />
                    แสดง
                  </label>
                </div>
                <ImagePreview src={category.imageUrl} alt={category.title} />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field
                    label="ชื่อที่แสดง"
                    name={`category.${category.id}.title`}
                    value={category.title}
                  />
                  <Field
                    label="คำอธิบาย"
                    name={`category.${category.id}.subtitle`}
                    value={category.subtitle}
                  />
                  <Field
                    label="พาธรูป"
                    name={`category.${category.id}.imageUrl`}
                    value={category.imageUrl}
                  />
                  <Field
                    label="ปลายทาง"
                    name={`category.${category.id}.href`}
                    value={category.href}
                  />
                  <OrderSelect
                    label="ลำดับ"
                    name={`categoryOrder.${category.id}`}
                    value={index + 1}
                    count={HOMEPAGE_CATEGORY_IDS.length}
                  />
                </div>
              </article>
            ))}
          </div>
        </EditorCard>

        <EditorCard title="รายการแนะนำ" description="เลือก Place เดิม ระบบจะอ่านชื่อ รูป และข้อมูลล่าสุดจาก Place CMS">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="recommended.enabled"
              defaultChecked={draft.recommended.enabled}
            />
            แสดงส่วนรายการแนะนำ
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="หัวข้อ" name="recommended.title" value={draft.recommended.title} />
            <Field label="คำอธิบาย" name="recommended.subtitle" value={draft.recommended.subtitle} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="recommended.useAutomaticSelection"
              defaultChecked={draft.recommended.useAutomaticSelection}
            />
            ให้ระบบคัดรายการอัตโนมัติ
          </label>
          <div className="grid max-h-72 gap-2 overflow-y-auto rounded-2xl bg-navy-950/45 p-3 sm:grid-cols-2">
            {places.map((place) => (
              <label key={place.id} className="grid grid-cols-[auto_1fr_52px] items-start gap-2 rounded-xl bg-white/5 p-3 text-sm">
                <input
                  type="checkbox"
                  name="recommended.placeIds"
                  value={place.id}
                  defaultChecked={draft.recommended.placeIds.includes(place.id)}
                />
                <span>
                  <span className="block font-medium">{place.name}</span>
                  <span className="text-xs text-white/50">
                    {place.category} · {place.area || "—"}
                    {place.businessId
                      ? ` · แนะนำโดย ${businessById.get(place.businessId)?.name ?? "ร้านพาร์ทเนอร์"}`
                      : " · KubHai"}
                  </span>
                </span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  name={`recommended.order.${place.id}`}
                  defaultValue={
                    draft.recommended.placeIds.indexOf(place.id) >= 0
                      ? draft.recommended.placeIds.indexOf(place.id) + 1
                      : 99
                  }
                  aria-label={`ลำดับ ${place.name}`}
                  className="h-8 w-full rounded-lg bg-navy-950/60 px-2 text-xs"
                />
              </label>
            ))}
          </div>
        </EditorCard>

        <EditorCard title="ร้านรถแนะนำ" description="เลือกจาก Store เดิม ลิงก์การ์ดจะไปยัง /s/{storeSlug}">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="agents.enabled" defaultChecked={draft.agents.enabled} />
            แสดงส่วนร้านรถแนะนำ
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="หัวข้อ" name="agents.title" value={draft.agents.title} />
            <Field label="คำอธิบาย" name="agents.subtitle" value={draft.agents.subtitle} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="agents.useAutomaticSelection"
              defaultChecked={draft.agents.useAutomaticSelection}
            />
            ให้ระบบเลือกร้านแรกอัตโนมัติ
          </label>
          <div className="grid gap-2 rounded-2xl bg-navy-950/45 p-3 sm:grid-cols-2">
            {activeBusinesses.map((business) => (
              <label key={business.id} className="grid grid-cols-[auto_1fr_52px] items-start gap-2 rounded-xl bg-white/5 p-3 text-sm">
                <input
                  type="checkbox"
                  name="agents.businessIds"
                  value={business.id}
                  defaultChecked={draft.agents.businessIds.includes(business.id)}
                />
                <span>
                  <span className="block font-medium">{business.name}</span>
                  <span className="text-xs text-white/50">/s/{business.slug}</span>
                </span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  name={`agents.order.${business.id}`}
                  defaultValue={
                    draft.agents.businessIds.indexOf(business.id) >= 0
                      ? draft.agents.businessIds.indexOf(business.id) + 1
                      : 99
                  }
                  aria-label={`ลำดับ ${business.name}`}
                  className="h-8 w-full rounded-lg bg-navy-950/60 px-2 text-xs"
                />
              </label>
            ))}
          </div>
        </EditorCard>

        <EditorCard
          title="การจัดเรียงหน้า"
          description="Hero และ Search ถูกตรึงไว้ด้านบนเพื่อรักษาเลย์เอาต์ที่อนุมัติ ส่วนด้านล่างสลับลำดับได้"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {draft.sectionOrder.map((sectionId, index) => (
              <OrderSelect
                key={sectionId}
                label={sectionLabel[sectionId]}
                name={`sectionOrder.${sectionId}`}
                value={index + 1}
                count={HOMEPAGE_SECTION_IDS.length}
              />
            ))}
          </div>
        </EditorCard>

        <div className="sticky bottom-4 z-20 flex justify-end">
          <button className="h-12 rounded-xl bg-white px-6 text-sm font-semibold text-navy-950 shadow-xl">
            บันทึกร่าง
          </button>
        </div>
      </form>
    </PlatformAdminShell>
  );
}

function EditorCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-3xl bg-white/5 p-5 ring-1 ring-white/8 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-white/55">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="block text-xs font-medium text-white/65">
      {label}
      <input name={name} defaultValue={value} className={inputClass} />
    </label>
  );
}

function TextArea({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="block text-xs font-medium text-white/65">
      {label}
      <textarea name={name} defaultValue={value} className={textareaClass} />
    </label>
  );
}

function CtaFields({
  prefix,
  title,
  enabled,
  label,
  href,
}: {
  prefix: string;
  title: string;
  enabled: boolean;
  label: string;
  href: string;
}) {
  return (
    <fieldset className="rounded-2xl bg-navy-950/45 p-4">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name={`${prefix}Enabled`} defaultChecked={enabled} />
        {title}
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="ข้อความปุ่ม" name={`${prefix}Label`} value={label} />
        <Field label="ปลายทาง" name={`${prefix}Href`} value={href} />
      </div>
    </fieldset>
  );
}

function OrderSelect({
  label,
  name,
  value,
  count,
}: {
  label: string;
  name: string;
  value: number;
  count: number;
}) {
  return (
    <label className="block text-xs font-medium text-white/65">
      {label}
      <select name={name} defaultValue={value} className={inputClass}>
        {Array.from({ length: count }, (_, index) => index + 1).map((position) => (
          <option key={position} value={position}>{position}</option>
        ))}
      </select>
    </label>
  );
}

function ImagePreview({
  src,
  alt,
  wide = false,
}: {
  src: string;
  alt: string;
  wide?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-navy-950 ${wide ? "aspect-[21/7]" : "mt-3 aspect-[16/7]"}`}>
      <Image src={src} alt={alt} fill sizes="600px" className="object-cover" />
    </div>
  );
}
