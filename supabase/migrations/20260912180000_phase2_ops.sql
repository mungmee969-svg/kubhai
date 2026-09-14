-- Phase 2 operations: notes, richer itinerary, extra indexes.
-- Does not change tenant model or ranking/sponsored separation.

create table if not exists public.booking_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_user_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.booking_itinerary_items
  add column if not exists location text,
  add column if not exists day_number integer,
  add column if not exists estimated_duration_minutes integer;

create index if not exists booking_notes_booking_idx
  on public.booking_notes (business_id, booking_id, created_at desc);

create index if not exists bookings_business_created_idx
  on public.bookings (business_id, created_at desc);

create index if not exists bookings_business_status_start_idx
  on public.bookings (business_id, status, start_date);

create index if not exists customers_business_updated_idx
  on public.customers (business_id, updated_at desc);

alter table public.booking_notes enable row level security;

create policy booking_notes_tenant on public.booking_notes
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

revoke all on public.booking_notes from anon;

create or replace function public.prevent_assignment_overlap()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('CONFIRMED', 'IN_PROGRESS') then
    return new;
  end if;

  if new.assigned_vehicle_id is not null and exists (
    select 1
    from public.bookings b
    where b.id <> new.id
      and b.business_id = new.business_id
      and b.assigned_vehicle_id = new.assigned_vehicle_id
      and b.status in ('CONFIRMED', 'IN_PROGRESS')
      and b.start_date <= coalesce(new.end_date, new.start_date)
      and coalesce(b.end_date, b.start_date) >= new.start_date
  ) then
    raise exception 'รถคันนี้มีงานที่ยืนยันแล้วทับช่วงวันเดียวกัน';
  end if;

  if new.assigned_driver_id is not null and exists (
    select 1
    from public.bookings b
    where b.id <> new.id
      and b.business_id = new.business_id
      and b.assigned_driver_id = new.assigned_driver_id
      and b.status in ('CONFIRMED', 'IN_PROGRESS')
      and b.start_date <= coalesce(new.end_date, new.start_date)
      and coalesce(b.end_date, b.start_date) >= new.start_date
  ) then
    raise exception 'คนขับคนนี้มีงานที่ยืนยันแล้วทับช่วงวันเดียวกัน';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_assignment_overlap on public.bookings;
create trigger bookings_assignment_overlap
  before insert or update of assigned_vehicle_id, assigned_driver_id, status, start_date, end_date
  on public.bookings
  for each row
  execute function public.prevent_assignment_overlap();
