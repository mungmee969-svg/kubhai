import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Booking creation persists to Supabase in production. Keep the legacy success
 * URL as a compatibility entry point, but resolve the booking through the
 * durable /booking/[token] page instead of the local JSON repository.
 */
export default async function BookingSuccessRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const normalized = token.trim();

  if (!normalized) {
    redirect("/");
  }

  redirect(`/booking/${encodeURIComponent(normalized)}`);
}
