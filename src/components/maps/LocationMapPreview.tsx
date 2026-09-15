export function LocationMapPreview({
  latitude,
  longitude,
  label,
  className = "",
  notConfiguredLabel = "Google Maps ยังไม่ได้ตั้งค่า",
  coordinatesUnavailableLabel = "ยังไม่มีพิกัดสำหรับแสดงแผนที่",
}: {
  latitude: number | null;
  longitude: number | null;
  label: string;
  className?: string;
  notConfiguredLabel?: string;
  coordinatesUnavailableLabel?: string;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || null;
  const hasCoordinates =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  if (!key || !hasCoordinates) {
    return (
      <div
        className={`rounded-2xl bg-[color:var(--cx-surface)] p-4 text-sm text-[color:var(--cx-textSecondary)] ring-1 ring-[color:var(--cx-border)] ${className}`}
      >
        <p className="font-medium text-[color:var(--cx-textPrimary)]">{label}</p>
        <p className="mt-1">
          {!key ? notConfiguredLabel : coordinatesUnavailableLabel}
        </p>
      </div>
    );
  }

  const src = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
    key,
  )}&q=${encodeURIComponent(`${latitude},${longitude}`)}`;
  return (
    <iframe
      title={label}
      src={src}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className={`h-64 w-full rounded-2xl border-0 ${className}`}
      allowFullScreen
    />
  );
}
