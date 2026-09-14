"use client";

export default function StoreError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-6">
      <p className="font-semibold text-navy-800">โหลดหน้านี้ไม่สำเร็จ</p>
      <p className="mt-1 text-sm text-muted">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 h-10 rounded-xl bg-navy-800 px-4 text-sm text-white"
      >
        ลองอีกครั้ง
      </button>
    </div>
  );
}
