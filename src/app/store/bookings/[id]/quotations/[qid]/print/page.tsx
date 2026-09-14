import { notFound } from "next/navigation";
import { PrintButton } from "@/components/quotation/PrintButton";
import { QuotationDocument } from "@/components/quotation/QuotationDocument";
import { requireStoreContext } from "@/lib/auth/tenant";

export const dynamic = "force-dynamic";

export default async function QuotationPrintPage({
  params,
}: {
  params: Promise<{ id: string; qid: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const { id, qid } = await params;
  const record = await ctx.store.getBookingById(ctx.actor, id);
  const quotation = await ctx.store.getQuotation(ctx.actor, qid);
  if (!record || !quotation || quotation.bookingId !== record.booking.id) notFound();

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <QuotationDocument
        quotation={quotation}
        booking={record.booking}
        business={record.business}
        customer={record.customer}
        itinerary={record.itinerary}
      />
    </div>
  );
}
