-- KubHai V1 foundation schema
-- Multi-tenant from day one. Never hardcode a business id in application logic.
-- Organic ranking_score MUST remain independent from featured/sponsored flags.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum (
  'SUPER_ADMIN',
  'BUSINESS_OWNER',
  'BUSINESS_STAFF',
  'CUSTOMER'
);

create type public.business_status as enum ('DRAFT', 'ACTIVE', 'SUSPENDED');

create type public.ownership_type as enum ('OWN', 'PARTNER');

create type public.driver_type as enum ('INTERNAL', 'PARTNER');

create type public.service_type as enum (
  'PRIVATE_DRIVER_DAILY',
  'AIRPORT_TRANSFER',
  'POINT_TO_POINT',
  'CUSTOM_TRIP',
  'MULTI_DAY_TRIP'
);

create type public.booking_status as enum (
  'REQUESTED',
  'CHECKING_AVAILABILITY',
  'AVAILABLE',
  'QUOTATION_SENT',
  'CUSTOMER_CONFIRMED',
  'WAITING_DEPOSIT',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED'
);

create type public.customer_type as enum ('PERSONAL', 'COMPANY');

create type public.quotation_status as enum (
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'REVISION_REQUESTED'
);

create type public.payment_status as enum (
  'PENDING',
  'SLIP_UPLOADED',
  'APPROVED',
  'REJECTED'
);

create type public.payment_method as enum (
  'BANK_TRANSFER',
  'PROMPTPAY',
  'QR',
  'GATEWAY'
);

create type public.place_category as enum (
  'ATTRACTION',
  'RESTAURANT',
  'LOCAL_FOOD',
  'CAFE',
  'HOTEL',
  'SPA',
  'SHOPPING',
  'SOUVENIR',
  'ACTIVITY',
  'OTHER'
);

create type public.booking_source as enum (
  'FACEBOOK',
  'LINE',
  'WEBSITE',
  'DIRECT',
  'GOOGLE',
  'TIKTOK',
  'OTHER'
);

create type public.document_type as enum (
  'TAX_INVOICE',
  'RECEIPT',
  'QUOTATION_PDF',
  'BOOKING_CARD'
);

create type public.domain_mapping_status as enum ('PENDING', 'ACTIVE', 'DISABLED');

-- ---------------------------------------------------------------------------
-- Geography
-- ---------------------------------------------------------------------------
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name_th text not null,
  name_en text not null,
  sort_order integer not null default 0
);

create table public.provinces (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id),
  name_th text not null,
  name_en text not null,
  slug text not null unique
);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.user_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Businesses / tenants
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  cover_url text,
  description text,
  phone text,
  line_url text,
  facebook_url text,
  instagram_url text,
  website_url text,
  email text,
  region_id uuid references public.regions(id),
  province_id uuid references public.provinces(id),
  address text,
  latitude double precision,
  longitude double precision,
  timezone text not null default 'Asia/Bangkok',
  currency text not null default 'THB',
  status public.business_status not null default 'DRAFT',
  verified_at timestamptz,
  average_rating numeric(3,2),
  review_count integer not null default 0,
  ranking_score numeric(10,2) not null default 0,
  featured boolean not null default false,
  sponsored boolean not null default false,
  subscription_plan text,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_organic_ranking_independent
    check (ranking_score >= 0)
);

comment on column public.businesses.ranking_score is
  'Organic ranking only. Must never be written from paid/sponsored state.';
comment on column public.businesses.sponsored is
  'Paid placement flag. Separate from ranking_score and average_rating.';
comment on column public.businesses.featured is
  'Editorial/organic feature flag. Separate from sponsored.';

create table public.business_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null check (role in ('BUSINESS_OWNER', 'BUSINESS_STAFF')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  faq jsonb not null default '[]'::jsonb,
  booking_notes text,
  default_deposit_percent numeric(5,2),
  allow_partner_vehicles boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.domain_mappings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  host text,
  path_slug text not null,
  status public.domain_mapping_status not null default 'PENDING',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (path_slug),
  unique (host)
);

create table public.business_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  bank_name text,
  account_name text,
  account_number text,
  promptpay_id text,
  qr_image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ownership_type public.ownership_type not null,
  vehicle_type text not null,
  brand text not null,
  model text not null,
  year integer,
  color text,
  plate_number text,
  seats integer not null check (seats > 0),
  luggage_capacity integer not null default 0,
  description text,
  amenities jsonb not null default '[]'::jsonb,
  base_price numeric(12,2),
  pricing_unit text,
  image_urls jsonb not null default '[]'::jsonb,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
  active boolean not null default true,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  driver_type public.driver_type not null,
  name text not null,
  nickname text,
  phone text,
  line_id text,
  photo_url text,
  license_number text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  active boolean not null default true,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers / bookings
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_type public.customer_type not null default 'PERSONAL',
  name text not null,
  phone text,
  email text,
  company_name text,
  tax_id text,
  branch_type text check (branch_type in ('HQ', 'BRANCH')),
  branch_number text,
  tax_invoice_address text,
  invoice_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_code text not null unique,
  secure_public_token text not null unique,
  client_request_id text not null,
  customer_id uuid references public.customers(id),
  customer_name_snapshot text not null,
  customer_phone_snapshot text not null,
  customer_email_snapshot text,
  customer_type public.customer_type not null default 'PERSONAL',
  company_name text,
  tax_id text,
  service_type public.service_type not null,
  start_date date not null,
  start_time time,
  end_date date,
  end_time time,
  passenger_count integer not null check (passenger_count > 0),
  luggage_count integer,
  pickup_location text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_location text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  trip_notes text,
  let_store_plan_trip boolean not null default false,
  preferred_vehicle_id uuid references public.vehicles(id),
  assigned_vehicle_id uuid references public.vehicles(id),
  assigned_driver_id uuid references public.drivers(id),
  status public.booking_status not null default 'REQUESTED',
  quoted_total numeric(12,2),
  deposit_amount numeric(12,2),
  paid_amount numeric(12,2) not null default 0,
  balance_amount numeric(12,2),
  source public.booking_source not null default 'DIRECT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, client_request_id)
);

create table public.booking_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  place_id uuid,
  title text not null,
  note text,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Quotations / payments / documents
-- ---------------------------------------------------------------------------
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  quotation_number text not null unique,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  deposit_required numeric(12,2) not null default 0,
  status public.quotation_status not null default 'DRAFT',
  valid_until timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  qty numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  quotation_id uuid references public.quotations(id),
  method public.payment_method not null default 'PROMPTPAY',
  amount numeric(12,2) not null,
  status public.payment_status not null default 'PENDING',
  slip_url text,
  admin_note text,
  idempotency_key text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid references public.bookings(id),
  document_type public.document_type not null,
  file_url text,
  number text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null references public.bookings(id),
  document_id uuid references public.documents(id),
  customer_type public.customer_type not null,
  company_name text,
  tax_id text,
  branch_type text,
  branch_number text,
  tax_invoice_address text,
  invoice_email text,
  amount numeric(12,2),
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Places / reviews / analytics / audit
-- ---------------------------------------------------------------------------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  province_id uuid not null references public.provinces(id),
  category public.place_category not null,
  name text not null,
  slug text not null,
  description text,
  image_urls jsonb not null default '[]'::jsonb,
  address text,
  latitude double precision,
  longitude double precision,
  opening_hours text,
  estimated_duration_minutes integer,
  entrance_fee text,
  local_recommended boolean not null default false,
  featured boolean not null default false,
  sponsored boolean not null default false,
  sponsor_business_name text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'HIDDEN')),
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (province_id, slug)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid references public.bookings(id),
  customer_id uuid references public.customers(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  session_id text not null,
  customer_id uuid,
  booking_id uuid,
  event_name text not null,
  event_data jsonb not null default '{}'::jsonb,
  source public.booking_source,
  referrer text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index bookings_business_status_idx on public.bookings (business_id, status, created_at desc);
create index bookings_business_dates_idx on public.bookings (business_id, start_date, end_date);
create index bookings_assigned_vehicle_idx on public.bookings (assigned_vehicle_id, start_date);
create index bookings_assigned_driver_idx on public.bookings (assigned_driver_id, start_date);
create index vehicles_business_idx on public.vehicles (business_id, active);
create index drivers_business_idx on public.drivers (business_id, active);
create index places_province_idx on public.places (province_id, category, status);
create index analytics_business_idx on public.analytics_events (business_id, event_name, created_at desc);
create index customers_business_phone_idx on public.customers (business_id, phone);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'SUPER_ADMIN'
      and p.active = true
  );
$$;

create or replace function public.accessible_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select bu.business_id
  from public.business_users bu
  where bu.user_id = auth.uid()
    and bu.active = true;
$$;

create or replace function public.has_business_access(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or target in (select public.accessible_business_ids());
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_touch before update on public.businesses
  for each row execute function public.touch_updated_at();
create trigger vehicles_touch before update on public.vehicles
  for each row execute function public.touch_updated_at();
create trigger drivers_touch before update on public.drivers
  for each row execute function public.touch_updated_at();
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- Public booking request RPC (idempotent on client_request_id)
create or replace function public.create_booking_request(
  p_business_slug text,
  p_client_request_id text,
  p_payload jsonb
)
returns table (
  booking_id uuid,
  booking_code text,
  secure_public_token text,
  reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_existing public.bookings%rowtype;
  v_booking public.bookings%rowtype;
  v_customer public.customers%rowtype;
begin
  select * into v_business
  from public.businesses
  where slug = p_business_slug and status = 'ACTIVE';

  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;

  select * into v_existing
  from public.bookings
  where business_id = v_business.id
    and client_request_id = p_client_request_id;

  if found then
    booking_id := v_existing.id;
    booking_code := v_existing.booking_code;
    secure_public_token := v_existing.secure_public_token;
    reused := true;
    return next;
    return;
  end if;

  select * into v_customer
  from public.customers
  where business_id = v_business.id
    and phone = p_payload->>'customer_phone'
  limit 1;

  if not found then
    insert into public.customers (
      business_id, customer_type, name, phone, email, company_name, tax_id
    ) values (
      v_business.id,
      coalesce((p_payload->>'customer_type')::public.customer_type, 'PERSONAL'),
      p_payload->>'customer_name',
      p_payload->>'customer_phone',
      p_payload->>'customer_email',
      p_payload->>'company_name',
      p_payload->>'tax_id'
    )
    returning * into v_customer;
  end if;

  insert into public.bookings (
    business_id,
    booking_code,
    secure_public_token,
    client_request_id,
    customer_id,
    customer_name_snapshot,
    customer_phone_snapshot,
    customer_email_snapshot,
    customer_type,
    company_name,
    tax_id,
    service_type,
    start_date,
    start_time,
    end_date,
    end_time,
    passenger_count,
    luggage_count,
    pickup_location,
    dropoff_location,
    trip_notes,
    let_store_plan_trip,
    preferred_vehicle_id,
    source
  ) values (
    v_business.id,
    'KH-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6)),
    encode(gen_random_bytes(32), 'base64'),
    p_client_request_id,
    v_customer.id,
    p_payload->>'customer_name',
    p_payload->>'customer_phone',
    p_payload->>'customer_email',
    coalesce((p_payload->>'customer_type')::public.customer_type, 'PERSONAL'),
    p_payload->>'company_name',
    p_payload->>'tax_id',
    (p_payload->>'service_type')::public.service_type,
    (p_payload->>'start_date')::date,
    nullif(p_payload->>'start_time', '')::time,
    nullif(p_payload->>'end_date', '')::date,
    nullif(p_payload->>'end_time', '')::time,
    coalesce((p_payload->>'passenger_count')::int, 1),
    nullif(p_payload->>'luggage_count', '')::int,
    p_payload->>'pickup_location',
    p_payload->>'dropoff_location',
    p_payload->>'trip_notes',
    coalesce((p_payload->>'let_store_plan_trip')::boolean, false),
    nullif(p_payload->>'preferred_vehicle_id', '')::uuid,
    coalesce((p_payload->>'source')::public.booking_source, 'DIRECT')
  )
  returning * into v_booking;

  booking_id := v_booking.id;
  booking_code := v_booking.booking_code;
  secure_public_token := v_booking.secure_public_token;
  reused := false;
  return next;
end;
$$;

create or replace function public.get_booking_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_reveal boolean;
begin
  if p_token is null or length(p_token) < 20 then
    return null;
  end if;

  select * into v_booking
  from public.bookings
  where secure_public_token = p_token;

  if not found then
    return null;
  end if;

  v_reveal := v_booking.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED');

  return jsonb_build_object(
    'booking', to_jsonb(v_booking) - 'customer_id',
    'reveal_assignment', v_reveal
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public views (no plates, no private driver fields, no customers)
-- ---------------------------------------------------------------------------
create view public.businesses_public as
select
  id, name, slug, logo_url, cover_url, description,
  phone, line_url, facebook_url, instagram_url, website_url,
  region_id, province_id, address, latitude, longitude,
  timezone, currency, status, featured, sponsored,
  verified_at, average_rating, review_count
from public.businesses
where status = 'ACTIVE';

create view public.vehicles_public as
select
  v.id, v.business_id, v.ownership_type, v.vehicle_type, v.brand, v.model,
  v.year, v.color, v.seats, v.luggage_capacity, v.description, v.amenities,
  v.base_price, v.pricing_unit, v.image_urls, v.active
from public.vehicles v
join public.businesses b on b.id = v.business_id
where v.active = true and b.status = 'ACTIVE';

create view public.places_public as
select
  id, business_id, province_id, category, name, slug, description,
  image_urls, address, latitude, longitude, opening_hours,
  estimated_duration_minutes, entrance_fee, local_recommended,
  featured, sponsored, sponsor_business_name, status
from public.places
where status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_users enable row level security;
alter table public.business_settings enable row level security;
alter table public.domain_mappings enable row level security;
alter table public.business_payment_accounts enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_itinerary_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.tax_invoices enable row level security;
alter table public.places enable row level security;
alter table public.reviews enable row level security;
alter table public.analytics_events enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid() or public.is_super_admin());

-- businesses
create policy businesses_public_read on public.businesses
  for select using (status = 'ACTIVE' or public.has_business_access(id));
create policy businesses_admin_write on public.businesses
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy businesses_owner_update on public.businesses
  for update using (public.has_business_access(id));

-- membership
create policy business_users_tenant on public.business_users
  for select using (public.has_business_access(business_id));

-- settings / payment accounts / mappings
create policy business_settings_tenant on public.business_settings
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));
create policy business_settings_public_read on public.business_settings
  for select using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.status = 'ACTIVE'
    )
  );

create policy payment_accounts_tenant on public.business_payment_accounts
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

create policy domain_mappings_tenant on public.domain_mappings
  for select using (
    status = 'ACTIVE' or public.has_business_access(business_id)
  );

-- vehicles / drivers
create policy vehicles_tenant on public.vehicles
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));
-- Public clients must use vehicles_public (no plate_number). Do not grant table SELECT to anon.

create policy drivers_tenant on public.drivers
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

-- customers / bookings never public
create policy customers_tenant on public.customers
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

create policy bookings_tenant on public.bookings
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

create policy itinerary_tenant on public.booking_itinerary_items
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

create policy quotations_tenant on public.quotations
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

create policy quotation_items_tenant on public.quotation_items
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

create policy payments_tenant on public.payments
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

create policy documents_tenant on public.documents
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

create policy tax_invoices_tenant on public.tax_invoices
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

-- places: public active + tenant write
create policy places_public_read on public.places
  for select using (status = 'ACTIVE' or public.has_business_access(business_id));
create policy places_tenant_write on public.places
  for all using (
    public.is_super_admin()
    or (business_id is not null and public.has_business_access(business_id))
  )
  with check (
    public.is_super_admin()
    or (business_id is not null and public.has_business_access(business_id))
  );

create policy reviews_public_read on public.reviews
  for select using (true);
create policy reviews_tenant on public.reviews
  for all using (public.has_business_access(business_id))
  with check (public.has_business_access(business_id));

-- analytics: insert from anyone, read by tenant only. No PII required.
create policy analytics_insert on public.analytics_events
  for insert with check (true);
create policy analytics_tenant_read on public.analytics_events
  for select using (
    business_id is null and public.is_super_admin()
    or public.has_business_access(business_id)
  );

create policy audit_tenant_read on public.audit_logs
  for select using (
    public.is_super_admin() or public.has_business_access(business_id)
  );
create policy audit_insert_auth on public.audit_logs
  for insert with check (auth.uid() is not null or public.is_super_admin());

-- Geography is public reference data
alter table public.regions enable row level security;
alter table public.provinces enable row level security;
create policy regions_read on public.regions for select using (true);
create policy provinces_read on public.provinces for select using (true);
create policy regions_admin on public.regions for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy provinces_admin on public.provinces for all using (public.is_super_admin()) with check (public.is_super_admin());

revoke all on public.customers from anon;
revoke all on public.bookings from anon;
revoke all on public.payments from anon;
revoke all on public.drivers from anon;
revoke all on public.vehicles from anon;
revoke all on public.audit_logs from anon;
revoke all on public.business_payment_accounts from anon;
revoke all on public.tax_invoices from anon;
revoke all on public.documents from anon;

grant select on public.regions, public.provinces, public.businesses_public, public.vehicles_public, public.places_public to anon, authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant execute on function public.create_booking_request(text, text, jsonb) to anon, authenticated;
grant execute on function public.get_booking_by_token(text) to anon, authenticated;
