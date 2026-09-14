import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { HomeDiscovery } from "@/components/discovery/HomeDiscovery";
import { PlaceRail } from "@/components/discovery/PlaceCard";
import {
  IconCar,
  IconPin,
  IconPlane,
  IconPlan,
  IconRoute,
  IconSteps,
  IconStore,
} from "@/components/marketing/icons";
import { groupDiscoveryRails } from "@/lib/domain/discovery";
import { DISCOVERY_HERO_IMAGE } from "@/lib/domain/place-image";
import {
  PARTNER_SERVICE_TYPE_LABELS,
  type PartnerServiceType,
} from "@/lib/domain/partner-types";
import { storefrontPath } from "@/lib/domain/storefront-url";
import { platformLoginHref } from "@/lib/auth/customer-auth-links";
import type { Place } from "@/lib/domain/types";

export type FeaturedStoreCard = {
  slug: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  coverUrl: string | null;
  provinceName: string;
  partnerServiceTypes: PartnerServiceType[];
};

const TRAVEL_SHORTCUTS = [
  { href: "/places?province=chiang-mai&category=ATTRACTION", label: "ที่เที่ยว", hint: "เที่ยว" },
  { href: "/places?province=chiang-mai&category=RESTAURANT", label: "ร้านอาหาร", hint: "กิน" },
  { href: "/places?province=chiang-mai&category=CAFE", label: "คาเฟ่", hint: "คาเฟ่" },
  { href: "/places?province=chiang-mai&category=HOTEL", label: "ที่พัก", hint: "พัก" },
  { href: "/places?province=chiang-mai&category=SHOPPING", label: "ช้อป / ของฝาก", hint: "ช้อป" },
  { href: "/places?province=chiang-mai&category=RELAXATION", label: "พักผ่อน", hint: "พักผ่อน" },
] as const;

const MOBILITY_SHORTCUTS = [
  { href: "/stores", label: "รถพร้อมคนขับ", Icon: IconCar },
  { href: "/stores", label: "รับส่งสนามบิน", Icon: IconPlane },
  { href: "/stores", label: "เช่ารถขับเอง", Icon: IconRoute },
  { href: "/stores", label: "เช่ามอเตอร์ไซค์", Icon: IconPin },
] as const;

const SEARCH_HINTS = [
  "รีวิวเชียงใหม่",
  "คาเฟ่เชียงใหม่วิวภูเขา",
  "คืนนี้ไปไหนดี",
  "ที่เที่ยวเชียงใหม่กลางคืน",
] as const;

const TRIPS = [
  { title: "เชียงใหม่ 1 วัน", subtitle: "เที่ยวในเมืองแบบสบาย ๆ" },
  { title: "เชียงใหม่ 2 วัน", subtitle: "เมือง + คาเฟ่ + ธรรมชาติ" },
  { title: "เชียงใหม่ยามค่ำคืน", subtitle: "กิน เที่ยว เดินเล่นช่วงเย็น" },
  { title: "เที่ยวหลายวัน", subtitle: "ให้พาร์ทเนอร์ช่วยวางแผน" },
] as const;

const BENEFITS = [
  {
    title: "ค้นพบก่อน แล้วค่อยเดินทาง",
    text: "ที่เที่ยว ร้านอาหาร คาเฟ่ ที่พัก และของฝาก — ก่อนเลือกรถจากพาร์ทเนอร์",
    Icon: IconPlan,
  },
  {
    title: "เลือกร้านพาร์ทเนอร์ได้",
    text: "KubHai เป็นแพลตฟอร์มค้นหา — บริการจริงมาจากร้านที่คุณเลือก",
    Icon: IconStore,
  },
  {
    title: "ส่งคำขอให้ร้าน",
    text: "ร้านตรวจสอบและส่งข้อเสนอก่อนยืนยัน — จ่ายตรงกับพาร์ทเนอร์",
    Icon: IconSteps,
  },
] as const;

export function KubHaiLanding({
  store,
  places,
  provinceId,
}: {
  store: FeaturedStoreCard;
  places: Place[];
  provinceId: string;
}) {
  const storeHref = storefrontPath(store.slug);
  const cover = store.coverUrl && !store.coverUrl.startsWith("/discovery/") ? store.coverUrl : DISCOVERY_HERO_IMAGE;
  const logo = store.logoUrl || "/brand/pond-logo.jpg";
  const rails = groupDiscoveryRails(places, provinceId);
  const partnerTags = store.partnerServiceTypes
    .slice(0, 4)
    .map((t) => PARTNER_SERVICE_TYPE_LABELS[t]);

  return (
    <div className="kh-landing min-h-dvh bg-[#f6f3ee] text-navy-950">
      <section className="relative isolate overflow-hidden">
        <div className="relative min-h-[min(92dvh,760px)] w-full md:min-h-[560px] lg:min-h-[640px]">
          <Image
            src={DISCOVERY_HERO_IMAGE}
            alt="บรรยากาศเที่ยวภาคเหนือ"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-900/40 to-navy-950/85 md:bg-gradient-to-r md:from-navy-950/88 md:via-navy-900/50 md:to-navy-950/30" />

          <div className="relative z-10 mx-auto flex h-full w-full max-w-[1280px] flex-col px-4 pb-6 pt-4 sm:px-6 md:pb-10 md:pt-6 lg:px-8">
            <header className="flex items-center justify-between gap-3">
              <Link href="/" className="flex items-center gap-2.5">
                <BrandMark size={40} priority className="shadow-lg ring-1 ring-white/25" />
                <span className="text-[1.05rem] font-semibold tracking-tight text-white">
                  KubHai
                  <span className="ml-1.5 text-sm font-medium text-white/70">ขับให้</span>
                </span>
              </Link>
              <Link
                href={platformLoginHref()}
                className="inline-flex h-10 items-center rounded-full bg-white/12 px-4 text-sm font-medium text-white backdrop-blur-md ring-1 ring-white/20 transition hover:bg-white/18"
              >
                เข้าสู่ระบบ
              </Link>
            </header>

            <div className="mt-auto grid gap-6 pt-14 md:mt-14 md:grid-cols-[1.05fr_0.95fr] md:items-end md:gap-8 md:pt-16 lg:gap-10 lg:pt-20">
              <div className="max-w-xl animate-[kh-rise_700ms_ease-out]">
                <p className="text-sm font-medium tracking-wide text-accent">เที่ยว • กิน • ช้อป • พัก • เดินทาง</p>
                <h1 className="mt-3 text-[2.05rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-[3.2rem]">
                  เที่ยวเหนือ ไปกับขับให้
                </h1>
                <p className="mt-3 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
                  ค้นหาที่เที่ยว ร้านอาหาร คาเฟ่ ที่พัก และบริการเดินทางจากพาร์ทเนอร์ในพื้นที่
                </p>
              </div>
              <DiscoveryPanel className="animate-[kh-rise_850ms_ease-out]" />
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-10 space-y-2">
        <section className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-accent-deep">วันนี้สนใจอะไร</p>
          <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            {TRAVEL_SHORTCUTS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex h-11 shrink-0 items-center rounded-full bg-white px-4 text-sm font-semibold text-navy-900 ring-1 ring-navy-950/8 transition hover:bg-navy-800 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            {MOBILITY_SHORTCUTS.map(({ href, label, Icon }) => (
              <Link
                key={label}
                href={href}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-navy-800/95 px-4 text-sm font-semibold text-white transition hover:bg-navy-700"
              >
                <Icon className="h-4 w-4 text-accent" />
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1280px] space-y-10 px-4 py-4 sm:px-6 lg:px-8">
          <HomeDiscovery places={places} provinceId={provinceId} />
          <PlaceRail title="วันนี้เที่ยวไหนดี" href="/places?province=chiang-mai&period=DAY" places={rails.day} />
          <PlaceRail title="คืนนี้ไปไหนดี" href="/places?province=chiang-mai&period=NIGHT" places={rails.night} />
          <PlaceRail title="ร้านอาหารน่าไป" href="/places?province=chiang-mai&category=RESTAURANT" places={rails.restaurants} />
          <PlaceRail title="คาเฟ่น่าแวะ" href="/places?province=chiang-mai&category=CAFE" places={rails.cafes} />
          <PlaceRail title="ที่พัก" href="/places?province=chiang-mai&category=HOTEL" places={rails.hotels} />
          <PlaceRail title="พักผ่อน" href="/places?province=chiang-mai&category=RELAXATION" places={rails.relaxation} />
          <PlaceRail title="ช้อป / ของฝาก" href="/places?province=chiang-mai&category=SHOPPING" places={[...rails.shopping, ...rails.souvenirs]} />
          <PlaceRail title="กิจกรรม" href="/places?province=chiang-mai&category=ACTIVITY" places={rails.activities} />
        </section>

        <section className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-accent-deep">เชียงใหม่</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-navy-900 sm:text-3xl">
                พาร์ทเนอร์เดินทาง
              </h2>
              <p className="mt-1.5 text-sm text-muted">บริการจากร้านพาร์ทเนอร์ — ไม่ใช่รถของ KubHai เอง</p>
            </div>
            <Link href="/stores" className="shrink-0 text-sm font-medium text-navy-700 underline-offset-4 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>

          <Link
            href={storeHref}
            className="group mt-5 block overflow-hidden rounded-[1.75rem] bg-white shadow-[0_18px_50px_-28px_rgba(1,36,79,0.45)] ring-1 ring-navy-950/5 transition duration-300 hover:-translate-y-0.5"
          >
            <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[21/9]">
              <Image src={cover} alt={store.name} fill sizes="(max-width: 768px) 100vw, 1200px" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/15 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 sm:bottom-6 sm:left-6 sm:right-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="relative h-12 w-12 overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-white/40">
                    <Image src={logo} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-accent">พาร์ทเนอร์</p>
                    <p className="truncate text-lg font-semibold text-white sm:text-xl">{store.name}</p>
                    <p className="text-sm text-white/75">{store.provinceName}</p>
                  </div>
                </div>
                <span className="hidden rounded-full bg-accent px-4 py-2 text-sm font-semibold text-navy-950 sm:inline-flex">
                  ดูบริการ
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-4 sm:px-6">
              {(partnerTags.length ? partnerTags : ["รถพร้อมคนขับ"]).map((badge) => (
                <span key={badge} className="rounded-full bg-navy-800/5 px-3 py-1.5 text-xs font-medium text-navy-800">
                  {badge}
                </span>
              ))}
              <span className="ml-auto text-sm font-semibold text-accent-deep sm:hidden">ดูบริการ</span>
            </div>
          </Link>
        </section>

        <section className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-navy-900 sm:text-3xl">ทริปแนะนำ</h2>
          <p className="mt-2 text-sm text-muted">แรงบันดาลใจสำหรับวางแผน — ไม่ใช่แพ็กเกจสำเร็จรูป</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRIPS.map((trip, index) => (
              <Link
                key={trip.title}
                href={storeHref}
                className="group relative overflow-hidden rounded-[1.5rem] bg-navy-800 p-5 text-white shadow-sm transition hover:bg-navy-700"
              >
                <div
                  className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-30"
                  style={{
                    background:
                      index % 2 === 0
                        ? "radial-gradient(circle, #fcad12, transparent 70%)"
                        : "radial-gradient(circle, #4fd1c5, transparent 70%)",
                  }}
                />
                <p className="text-lg font-semibold">{trip.title}</p>
                <p className="mt-1 text-sm text-white/70">{trip.subtitle}</p>
                <span className="mt-6 inline-flex text-sm font-semibold text-accent transition group-hover:translate-x-0.5">
                  เริ่มวางแผนทริป →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-navy-950/5 bg-white/70">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <h2 className="max-w-lg text-2xl font-semibold tracking-tight text-navy-900 sm:text-3xl">
              เที่ยวเชียงใหม่ง่ายขึ้นกับ KubHai
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
              {BENEFITS.map(({ title, text, Icon }) => (
                <li key={title} className="rounded-[1.5rem] bg-[#f6f3ee] p-5 ring-1 ring-navy-950/5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-800 text-accent">
                    <Icon />
                  </span>
                  <p className="mt-4 text-base font-semibold text-navy-900">{title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-sm text-muted">
              สมัครสมาชิกครั้งเดียวบน KubHai แล้วใช้บัญชีเดียวกันกับพาร์ทเนอร์หลายร้าน — ไม่ต้องสมัครใหม่ทุกร้าน
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8 lg:pb-14">
          <div className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-navy-900 via-navy-800 to-[#06314f] p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
            <div className="max-w-xl">
              <p className="text-lg font-semibold">มีบริการเดินทางในพื้นที่?</p>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                เปิดหน้าร้านพาร์ทเนอร์บน KubHai และจัดการคำขอจองของคุณ — รับชำระจากลูกค้าโดยตรง
              </p>
            </div>
            <Link
              href="/store/login"
              className="mt-5 inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-navy-900 transition hover:bg-accent sm:mt-0"
            >
              สำหรับพาร์ทเนอร์
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-navy-950/8 bg-white">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-8">
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} />
            <div>
              <p className="font-semibold text-navy-900">KubHai</p>
              <p className="text-xs text-muted">ขับให้ · แพลตฟอร์มค้นหาเที่ยวและเดินทาง</p>
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-navy-800 sm:flex sm:flex-wrap sm:gap-x-8">
            <Link href="/services">บริการ</Link>
            <Link href="/province/chiang-mai">พื้นที่ให้บริการ</Link>
            <Link href="/places?province=chiang-mai&category=ATTRACTION">ที่เที่ยว</Link>
            <Link href="/places?province=chiang-mai&category=RESTAURANT">ร้านอาหาร</Link>
            <Link href="/places?province=chiang-mai&category=CAFE">คาเฟ่</Link>
            <Link href="/places?province=chiang-mai&category=HOTEL">ที่พัก</Link>
            <Link href="/stores">พาร์ทเนอร์เดินทาง</Link>
            <Link href={platformLoginHref()}>เข้าสู่ระบบ</Link>
            <Link href="/store/login">เข้าสู่ระบบร้าน</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function DiscoveryPanel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-[1.75rem] bg-white/95 p-4 shadow-[0_24px_60px_-20px_rgba(0,22,62,0.55)] ring-1 ring-white/40 backdrop-blur-md sm:p-5 ${className}`}
    >
      <p className="text-lg font-semibold text-navy-900">ค้นหาแรงบันดาลใจ</p>
      <Link
        href="/places?province=chiang-mai"
        className="mt-3 flex h-12 items-center gap-2 rounded-2xl bg-[#f3efe8] px-4 text-sm text-navy-800 ring-1 ring-navy-950/5 transition hover:bg-[#ebe5db]"
      >
        <IconPin className="h-4 w-4 shrink-0 text-accent-deep" />
        <span className="truncate text-muted">เช่น รีวิวคาเฟ่เชียงใหม่ / คืนนี้ไปไหนดี</span>
      </Link>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SEARCH_HINTS.map((hint) => (
          <Link
            key={hint}
            href={`/places?province=chiang-mai&q=${encodeURIComponent(hint)}`}
            className="rounded-full bg-navy-800/5 px-2.5 py-1 text-[11px] font-medium text-navy-800"
          >
            {hint}
          </Link>
        ))}
      </div>

      <Link
        href="/province/chiang-mai"
        className="mt-3 flex h-11 items-center justify-between rounded-2xl bg-white px-4 text-sm font-medium text-navy-900 ring-1 ring-navy-950/8 transition hover:bg-[#f8f5f0]"
      >
        <span className="inline-flex items-center gap-2">
          <IconPin className="h-4 w-4 text-accent-deep" />
          เชียงใหม่
        </span>
        <span className="text-xs text-muted">ภาคเหนือ</span>
      </Link>
    </div>
  );
}
