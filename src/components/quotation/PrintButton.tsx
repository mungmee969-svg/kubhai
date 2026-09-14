"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="h-10 rounded-xl bg-navy-800 px-4 text-sm text-white">
      พิมพ์ / บันทึก PDF
    </button>
  );
}
