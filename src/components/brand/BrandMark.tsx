import Image from "next/image";
import { kubhaiBrand } from "@/lib/brand/tokens";

type Props = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function BrandMark({ size = 56, className = "", priority }: Props) {
  return (
    <Image
      src={kubhaiBrand.logoSrc}
      alt="KubHai ขับให้"
      width={size}
      height={size}
      priority={priority}
      className={`rounded-[22%] shadow-sm ${className}`}
    />
  );
}

export function PoweredByKubHai({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center gap-2 text-xs text-muted ${className}`}>
      <BrandMark size={20} />
      <span>Powered by KubHai</span>
    </p>
  );
}
