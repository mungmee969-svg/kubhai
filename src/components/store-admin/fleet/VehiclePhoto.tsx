import { vehiclePhoto } from "@/lib/domain/fleet";
import type { Vehicle } from "@/lib/domain/types";

export function VehiclePhoto({
  vehicle,
  className = "h-full w-full object-cover",
}: {
  vehicle: Vehicle;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={vehiclePhoto(vehicle)} alt={`${vehicle.brand} ${vehicle.model}`} className={className} />
  );
}
