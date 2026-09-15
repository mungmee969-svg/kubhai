import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { platformLoginHref } from "@/lib/auth/customer-auth-links";
import { groupDiscoveryRails, placeShortText } from "@/lib/domain/discovery";
import {
  PARTNER_SERVICE_TYPE_LABELS,
  type PartnerServiceType,
} from "@/lib/domain/partner-types";
import { resolvePlaceImageUrl } from "@/lib/domain/place-image";
import { storefrontPath } from "@/lib/domain/storefront-url";
import {
  splitHomepageLines,
  type HomepageConfig,
  type HomepageCategoryId,
} from "@/lib/domain/homepage-cms";
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

const CATEGORY_ICONS: Record<HomepageCategoryId, string> = {
  attractions: "⌁",
  restaurants: "◌",
  cafes: "☕",
  transport: "◆",
};

export function KubHaiLanding({
  config,
  storeNamesById,
  stores,
  places,
  provinceId,
}: {
  config: HomepageConfig;
  storeNamesById: Record<string, string>;
  stores: FeaturedStoreCard[];
  places: Place[];
  provinceId: string;
}) {
  const rails = groupDiscoveryRails(
    places.filter((place) => place.sourceType === "PLATFORM"),
    provinceId,
  );
  const automaticRecommendations = uniquePlaces([
    ...rails.attractions.slice(0, 2),
    ...rails.restaurants.slice(0, 2),
    ...rails.cafes.slice(0, 2),
    ...rails.day,
  ]).slice(0, 6);
  const recommendations = config.recommended.useAutomaticSelection
    ? automaticRecommendations
    : config.recommended.placeIds
        .map((id) => places.find((place) => place.id === id))
        .filter((place): place is Place => Boolean(place));

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#f8f3e9] text-[#082747]">
      <Hero config={config.hero} />
      {config.search.enabled ? <DiscoverySearch config={config.search} /> : null}

      <main>
        {config.sectionOrder.map((sectionId) => {
          if (sectionId === "categories") {
            return (
              <CategorySection
                key={sectionId}
                categories={config.categories}
                followsSearch={config.search.enabled}
              />
            );
          }
          if (sectionId === "recommended") {
            return (
              <RecommendedSection
                key={sectionId}
                config={config.recommended}
                places={recommendations}
                storeNamesById={storeNamesById}
              />
            );
          }
          return (
            <TransportSection
              key={sectionId}
              config={config.agents}
              stores={stores}
            />
          );
        })}
      </main>

      <footer className="relative isolate overflow-hidden bg-[#061d38] text-white">
        <Image
          src="/home/lanna-hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-bottom opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#061d38] via-[#061d38]/95 to-[#061d38]/80" />
        <div className="relative mx-auto flex w-full max-w-[1220px] flex-col gap-6 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <BrandMark size={42} className="ring-1 ring-white/30" />
            <div>
              <p className="text-lg font-semibold leading-none">KubHai</p>
              <p className="mt-1 text-xs tracking-wide text-white/60">ขับให้</p>
            </div>
          </div>
          <div className="max-w-xl md:text-right">
            <p className="text-base font-medium text-[#f6b52f]">“ขับให้...พาคุณไปได้ไกลกว่า”</p>
            <p className="mt-1.5 text-sm text-white/65">
              ค้นพบเรื่องราว สถานที่ และการเดินทางในแบบล้านนา
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Hero({ config }: { config: HomepageConfig["hero"] }) {
  const headlineLines = splitHomepageLines(config.headline);
  const descriptionLines = splitHomepageLines(config.description);
  return (
    <section className="relative isolate min-h-[650px] overflow-hidden bg-[#071f3b] sm:min-h-[680px] lg:min-h-[700px]">
      <Image
        src={config.imageUrl}
        alt="วัดล้านนาท่ามกลางขุนเขาและทะเลหมอกยามเช้า"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[64%_center] sm:object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#04182f]/85 via-[#071f3b]/25 to-[#071f3b]/90 lg:bg-gradient-to-r lg:from-[#04182f]/95 lg:via-[#071f3b]/60 lg:to-[#071f3b]/12" />

      <div className="relative mx-auto flex min-h-[650px] w-full max-w-[1220px] flex-col px-5 sm:min-h-[680px] sm:px-8 lg:min-h-[700px] lg:px-10">
        <PublicHeader />

        <div className="flex flex-1 items-center py-16">
          {config.enabled ? <div className="max-w-[650px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f6b52f] sm:text-xs">
              {config.eyebrow}
            </p>
            <h1 className="mt-5 text-[2.65rem] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.4rem]">
              {headlineLines[0]}
              {headlineLines.slice(1).map((line) => (
                <span key={line} className="block text-[#ffc34b]">{line}</span>
              ))}
            </h1>
            <p className="mt-5 max-w-[560px] text-base leading-7 text-white/82 sm:text-lg sm:leading-8">
              {descriptionLines.map((line, index) => (
                <span key={`${line}-${index}`} className="block">{line}</span>
              ))}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {config.primaryCtaEnabled ? <Link
                href={config.primaryCtaHref}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f6ad22] px-6 text-sm font-semibold text-[#082747] shadow-[0_12px_30px_-14px_rgba(246,173,34,0.85)] transition hover:bg-[#ffc34b]"
              >
                {config.primaryCtaLabel}
              </Link> : null}
              {config.secondaryCtaEnabled ? <Link
                href={config.secondaryCtaHref}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/10 px-6 text-sm font-semibold text-white ring-1 ring-white/35 backdrop-blur-sm transition hover:bg-white/18"
              >
                {config.secondaryCtaLabel}
              </Link> : null}
            </div>
          </div> : null}
        </div>
      </div>
    </section>
  );
}

function PublicHeader() {
  const links = [
    { href: "/", label: "หน้าแรก" },
    { href: "/places?province=chiang-mai&category=ATTRACTION", label: "ที่เที่ยว" },
    { href: "/places?province=chiang-mai&category=RESTAURANT", label: "ร้านอาหาร" },
    { href: "/stores", label: "บริการรถ" },
  ];

  return (
    <header className="flex h-[76px] items-center justify-between gap-5 border-b border-white/15">
      <Link href="/" aria-label="KubHai หน้าแรก" className="flex shrink-0 items-center gap-2.5">
        <BrandMark size={42} priority className="ring-1 ring-white/30" />
        <span className="text-lg font-semibold tracking-tight text-white">
          KubHai <span className="text-xs font-medium text-white/65">ขับให้</span>
        </span>
      </Link>

      <nav className="hidden items-center gap-7 lg:flex" aria-label="เมนูหลัก">
        {links.map((item, index) => (
          <Link
            key={item.label}
            href={item.href}
            className={`border-b py-2 text-sm transition ${
              index === 0
                ? "border-[#f6ad22] font-semibold text-white"
                : "border-transparent text-white/75 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="hidden items-center gap-2 sm:flex">
        <Link
          href={platformLoginHref()}
          className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-white/80 transition hover:text-white"
        >
          เข้าสู่ระบบ
        </Link>
        <Link
          href="/stores"
          className="inline-flex h-10 items-center rounded-full bg-[#f6ad22] px-5 text-sm font-semibold text-[#082747] transition hover:bg-[#ffc34b]"
        >
          ค้นหารถ
        </Link>
      </div>

      <details className="group relative sm:hidden">
        <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/25">
          <span className="sr-only">เปิดเมนู</span>
          <span aria-hidden="true" className="text-xl leading-none">☰</span>
        </summary>
        <div className="absolute right-0 top-13 z-30 w-52 rounded-2xl bg-white p-2 text-[#082747] shadow-2xl">
          {links.map((item) => (
            <Link key={item.label} href={item.href} className="block rounded-xl px-3 py-2.5 text-sm hover:bg-[#f8f3e9]">
              {item.label}
            </Link>
          ))}
          <div className="my-1 border-t border-[#082747]/10" />
          <Link href={platformLoginHref()} className="block rounded-xl px-3 py-2.5 text-sm hover:bg-[#f8f3e9]">
            เข้าสู่ระบบ
          </Link>
          <Link href="/stores" className="mt-1 block rounded-xl bg-[#f6ad22] px-3 py-2.5 text-center text-sm font-semibold">
            ค้นหารถ
          </Link>
        </div>
      </details>
    </header>
  );
}

function DiscoverySearch({ config }: { config: HomepageConfig["search"] }) {
  return (
    <div
      id="discover"
      className="relative z-20 mx-auto -mt-16 mb-4 w-[calc(100%_-_2.5rem)] max-w-[1140px] rounded-[1.4rem] border border-[#082747]/10 bg-white p-4 shadow-[0_24px_60px_-24px_rgba(3,27,51,0.45)] sm:-mt-14 sm:mb-6 sm:w-[calc(100%_-_4rem)] sm:p-5"
    >
      <form action="/places" className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
        <input type="hidden" name="province" value={config.defaultAreaSlug} />
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-[#082747]/65">
            {config.heading}
          </span>
          <span className="flex h-12 items-center rounded-xl bg-[#f8f3e9] px-4 ring-1 ring-[#082747]/8 focus-within:ring-[#d89311]">
            <span aria-hidden="true" className="mr-2 text-[#d89311]">⌕</span>
            <input
              name="q"
              type="search"
              placeholder={config.placeholder}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#526476]/70"
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-[#082747]/65">พื้นที่</span>
          <select
            name="area"
            defaultValue="chiang-mai"
            className="h-12 w-full rounded-xl bg-[#f8f3e9] px-4 text-sm font-medium outline-none ring-1 ring-[#082747]/8"
          >
            <option value={config.defaultAreaSlug}>{config.defaultAreaLabel}</option>
          </select>
        </label>
        <button
          type="submit"
          className="h-12 rounded-xl bg-[#f6ad22] px-7 text-sm font-semibold text-[#082747] transition hover:bg-[#ffc34b]"
        >
          ค้นหา
        </button>
      </form>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
        <span className="shrink-0 py-1 text-[11px] text-[#526476]">ค้นหายอดนิยม:</span>
        {config.popularSearches.map((item) => (
          <Link
            key={item.label}
            href={`/places?province=${encodeURIComponent(config.defaultAreaSlug)}&q=${encodeURIComponent(item.query)}`}
            className="shrink-0 rounded-full bg-[#082747]/5 px-2.5 py-1 text-[11px] font-medium text-[#27425e] transition hover:bg-[#082747]/10"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function CategorySection({
  categories,
  followsSearch,
}: {
  categories: HomepageConfig["categories"];
  followsSearch: boolean;
}) {
  const visibleCategories = categories.filter((item) => item.enabled);
  if (!visibleCategories.length) return null;
  return (
    <section className={`mx-auto w-full max-w-[1220px] px-5 pb-14 sm:px-8 lg:px-10 ${followsSearch ? "pt-14 sm:pt-16" : "pt-14"}`}>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c47e05]">Explore Lanna</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">วันนี้อยากไปไหนดี?</h2>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {visibleCategories.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="group relative aspect-[4/5] overflow-hidden rounded-[1.35rem] bg-[#082747] shadow-[0_18px_35px_-24px_rgba(8,39,71,0.65)] sm:aspect-[4/3] lg:aspect-[5/4]"
          >
            <Image
              src={item.imageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition duration-500 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#04182f]/90 via-[#04182f]/12 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3.5 text-white sm:p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm text-[#082747]">
                {CATEGORY_ICONS[item.id]}
              </span>
              <p className="mt-2 text-base font-semibold sm:text-lg">{item.title}</p>
              <p className="mt-0.5 hidden text-xs text-white/65 sm:block">{item.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecommendedSection({
  config,
  places,
  storeNamesById,
}: {
  config: HomepageConfig["recommended"];
  places: Place[];
  storeNamesById: Record<string, string>;
}) {
  if (!config.enabled || !places.length) return null;

  return (
    <section id="recommended" className="border-y border-[#082747]/7 bg-[#fffdf8]">
      <div className="mx-auto w-full max-w-[1220px] px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-7 w-1 rounded-full bg-[#f6ad22]" />
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{config.title}</h2>
            </div>
            <p className="mt-2 text-sm text-[#526476]">
              {config.subtitle}
            </p>
          </div>
          <Link
            href="/places?province=chiang-mai"
            className="hidden shrink-0 text-sm font-semibold text-[#174e7c] hover:underline sm:block"
          >
            ดูทั้งหมด →
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
          {places.map((place) => {
            const short = placeShortText(place);
            return (
              <Link
                key={place.id}
                href={`/places/${place.slug}`}
                className="group overflow-hidden rounded-2xl bg-white shadow-[0_12px_28px_-22px_rgba(8,39,71,0.7)] ring-1 ring-[#082747]/7"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e1d2]">
                  <Image
                    src={homePlaceImage(place)}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 17vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-white/92 px-2 py-1 text-[10px] font-semibold text-[#174e7c] shadow-sm">
                    {placeCategoryLabel(place)}
                  </span>
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-semibold text-[#082747]">{place.name}</p>
                  <p className="mt-1 line-clamp-1 text-[11px] text-[#526476]">
                    {place.area || place.district || "เชียงใหม่"}
                  </p>
                  {short ? (
                    <p className="mt-1.5 hidden line-clamp-2 text-[11px] leading-relaxed text-[#526476] sm:block">
                      {short}
                    </p>
                  ) : null}
                  {place.businessId && storeNamesById[place.businessId] ? (
                    <p className="mt-2 truncate text-[10px] font-medium text-[#8a650e]">
                      แนะนำโดย {storeNamesById[place.businessId]}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
        <Link
          href="/places?province=chiang-mai"
          className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-[#174e7c] sm:hidden"
        >
          ดูสถานที่ทั้งหมด →
        </Link>
      </div>
    </section>
  );
}

function TransportSection({
  config,
  stores,
}: {
  config: HomepageConfig["agents"];
  stores: FeaturedStoreCard[];
}) {
  if (!config.enabled || !stores.length) return null;

  return (
    <section className="mx-auto w-full max-w-[1220px] px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c47e05]">Local Partners</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {config.title}
        </h2>
        <p className="mt-2 text-sm text-[#526476]">
          {config.subtitle}
        </p>
      </div>

      <div className={`mt-7 grid gap-4 ${stores.length > 1 ? "md:grid-cols-2" : "max-w-[620px]"}`}>
        {stores.slice(0, 2).map((store) => {
          const tags = store.partnerServiceTypes
            .slice(0, 3)
            .map((type) => PARTNER_SERVICE_TYPE_LABELS[type]);
          return (
            <Link
              key={store.slug}
              href={storefrontPath(store.slug)}
              className="group grid min-h-[220px] overflow-hidden rounded-[1.4rem] bg-white shadow-[0_18px_42px_-30px_rgba(8,39,71,0.75)] ring-1 ring-[#082747]/7 sm:grid-cols-[42%_1fr]"
            >
              <div className="relative min-h-40 overflow-hidden bg-[#082747]">
                <Image
                  src={storeCover(store.coverUrl)}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#04182f]/45 to-transparent sm:bg-gradient-to-r" />
              </div>
              <div className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-[#082747]/10">
                    <Image
                      src={store.logoUrl || "/brand/pond-logo.svg"}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c47e05]">Partner</p>
                    <p className="truncate font-semibold text-[#082747]">{store.name}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-[#526476]">{store.provinceName}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(tags.length ? tags : ["บริการเดินทาง"]).map((tag) => (
                    <span key={tag} className="rounded-full bg-[#082747]/5 px-2.5 py-1 text-[10px] text-[#27425e]">
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="mt-auto pt-5 text-sm font-semibold text-[#174e7c]">ดูหน้าร้าน →</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-7 text-center">
        <Link
          href="/stores"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#082747] px-6 text-sm font-semibold text-white transition hover:bg-[#174e7c]"
        >
          ดูร้านรถทั้งหมด
        </Link>
      </div>
    </section>
  );
}

function uniquePlaces(places: Place[]): Place[] {
  return places.filter(
    (place, index, rows) => rows.findIndex((candidate) => candidate.id === place.id) === index,
  );
}

function homePlaceImage(place: Place): string {
  const source = resolvePlaceImageUrl(place);
  if (!source.startsWith("/discovery/placeholders/")) return source;
  if (place.category === "ATTRACTION") return "/home/category-attraction.jpg";
  if (place.category === "RESTAURANT" || place.category === "LOCAL_FOOD") {
    return "/home/category-food.jpg";
  }
  if (place.category === "CAFE") return "/home/category-cafe.jpg";
  return "/home/lanna-hero.jpg";
}

function placeCategoryLabel(place: Place): string {
  if (place.category === "RESTAURANT" || place.category === "LOCAL_FOOD") return "ร้านอาหาร";
  if (place.category === "CAFE") return "คาเฟ่";
  if (place.category === "ATTRACTION") return "ที่เที่ยว";
  return "แนะนำ";
}

function storeCover(url: string | null): string {
  if (!url || url.startsWith("/discovery/")) return "/home/category-transport.jpg";
  return url;
}
