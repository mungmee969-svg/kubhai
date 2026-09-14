import Image from "next/image";
import Link from "next/link";
import {
  DISCOVERY_CATEGORY_LABELS,
  discoveryCategoryOf,
  placeCoverUrl,
  placeShortText,
} from "@/lib/domain/discovery";
import { PLACE_KIND_LABELS, isSpecificBusinessPlace } from "@/lib/domain/place-image";
import type { Place } from "@/lib/domain/types";

export function PlaceCard({ place, layout = "rail" }: { place: Place; layout?: "rail" | "grid" }) {
  const cover = placeCoverUrl(place);
  const chip = discoveryCategoryOf(place);
  const categoryLabel = chip ? DISCOVERY_CATEGORY_LABELS[chip] : "สถานที่";
  const short = placeShortText(place);
  const kindLabel = !isSpecificBusinessPlace(place) ? PLACE_KIND_LABELS[place.placeKind] : null;
  const widthClass =
    layout === "grid"
      ? "w-full max-w-none"
      : "w-[72vw] max-w-[240px] shrink-0 sm:w-auto sm:max-w-none";

  return (
    <Link
      href={`/places/${place.slug}`}
      className={`group relative flex ${widthClass} flex-col overflow-hidden rounded-[1.35rem] bg-white shadow-[0_12px_36px_-24px_rgba(1,36,79,0.45)] ring-1 ring-navy-950/5`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-navy-800">
        <Image
          src={cover}
          alt=""
          fill
          sizes="240px"
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/55 via-transparent to-transparent" />
        {place.sponsored ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-navy-800">
            {place.sponsorLabel || "สนับสนุน"}
          </span>
        ) : null}
        <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-navy-800">
          {categoryLabel}
        </span>
        {kindLabel ? (
          <span className="absolute bottom-3 right-3 rounded-full bg-navy-900/80 px-2.5 py-1 text-[10px] font-medium text-white">
            {kindLabel}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3.5 py-3">
        <p className="line-clamp-1 text-sm font-semibold text-navy-900">{place.name}</p>
        {place.area ? <p className="text-xs text-muted">{place.area}</p> : null}
        {short ? <p className="line-clamp-2 text-xs leading-relaxed text-muted">{short}</p> : null}
        <span className="mt-auto pt-2 text-xs font-semibold text-accent-deep">ดูรายละเอียด →</span>
      </div>
    </Link>
  );
}

export function PlaceRail({
  title,
  href,
  places,
}: {
  title: string;
  href: string;
  places: Place[];
}) {
  if (!places.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <h3 className="text-lg font-semibold tracking-tight text-navy-900">{title}</h3>
        <Link href={href} className="shrink-0 text-sm font-medium text-navy-700 underline-offset-4 hover:underline">
          ดูทั้งหมด
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
        {places.map((place) => (
          <PlaceCard key={place.id} place={place} />
        ))}
      </div>
    </section>
  );
}
