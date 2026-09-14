import { BrandMark } from "@/components/brand/BrandMark";

export default function Loading() {
  return (
    <div className="min-h-dvh bg-navy-800 flex flex-col items-center justify-center gap-4">
      <BrandMark size={88} />
      <p className="text-white text-sm tracking-wide">KubHai</p>
    </div>
  );
}
