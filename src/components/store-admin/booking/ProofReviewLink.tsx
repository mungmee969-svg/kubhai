import Link from "next/link";

export function ProofReviewLink({ bookingId, proofId }: { bookingId: string; proofId: string }) {
  return (
    <Link
      href={`/store/bookings/${bookingId}?proof=${proofId}`}
      className="inline-flex h-10 items-center rounded-xl bg-navy-800 px-4 text-sm text-white"
    >
      ตรวจสอบ
    </Link>
  );
}
