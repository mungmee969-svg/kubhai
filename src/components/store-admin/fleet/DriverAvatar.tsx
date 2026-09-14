import { driverInitials } from "@/lib/domain/fleet";
import type { Driver } from "@/lib/domain/types";

export function DriverAvatar({
  driver,
  size = "sm",
}: {
  driver?: Driver | null;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "h-9 w-9 text-sm" : "h-6 w-6 text-[10px]";
  if (!driver) {
    return <span className={`inline-flex ${dim} items-center justify-center rounded-full bg-line text-muted`}>?</span>;
  }
  if (driver.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={driver.photoUrl} alt={driver.name} className={`${dim} rounded-full object-cover`} />
    );
  }
  return (
    <span className={`inline-flex ${dim} items-center justify-center rounded-full bg-navy-800 font-medium text-white`}>
      {driverInitials(driver.nickname || driver.name)}
    </span>
  );
}
