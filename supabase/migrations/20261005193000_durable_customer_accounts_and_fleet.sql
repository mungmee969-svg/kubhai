create table if not exists public.customer_accounts (
  id uuid primary key,
  phone text not null unique,
  phone_verified_at timestamptz,
  display_name text,
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_accounts enable row level security;

create or replace function public.upsert_pilot_customer_account(
  p_id uuid,
  p_phone text,
  p_display_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.customer_accounts;
begin
  if p_phone is null or length(trim(p_phone)) < 8 then
    raise exception 'invalid_phone';
  end if;
  insert into public.customer_accounts(id, phone, phone_verified_at, display_name)
  values (p_id, trim(p_phone), now(), nullif(trim(coalesce(p_display_name,'')), ''))
  on conflict (phone) do update set
    phone_verified_at = coalesce(customer_accounts.phone_verified_at, excluded.phone_verified_at),
    display_name = coalesce(excluded.display_name, customer_accounts.display_name),
    updated_at = now()
  returning * into v_row;
  return jsonb_build_object(
    'id', v_row.id, 'phone', v_row.phone,
    'phoneVerifiedAt', v_row.phone_verified_at,
    'displayName', v_row.display_name
  );
end $$;

create or replace function public.claim_public_booking_request(
  p_token text,
  p_customer_account_id uuid,
  p_phone text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_account public.customer_accounts; v_booking public.booking_requests;
begin
  select * into v_account from public.customer_accounts
   where id = p_customer_account_id and phone = trim(p_phone) and phone_verified_at is not null;
  if not found then raise exception 'customer_account_not_found'; end if;

  select * into v_booking from public.booking_requests where secure_public_token = p_token for update;
  if not found then raise exception 'booking_not_found'; end if;

  if coalesce(v_booking.payload->>'customerAccountId','') <> ''
     and v_booking.payload->>'customerAccountId' <> p_customer_account_id::text then
    raise exception 'booking_already_claimed';
  end if;
  if regexp_replace(coalesce(v_booking.payload->>'customerPhone',''), '\\D', '', 'g')
     <> regexp_replace(coalesce(p_phone,''), '\\D', '', 'g') then
    raise exception 'phone_mismatch';
  end if;

  update public.booking_requests
  set payload = jsonb_set(payload, '{customerAccountId}', to_jsonb(p_customer_account_id::text), true),
      updated_at = now()
  where id = v_booking.id;

  return jsonb_build_object('id', v_booking.id, 'customerAccountId', p_customer_account_id);
end $$;

create or replace function public.list_store_fleet(p_business_id uuid, p_admin_token text)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'vehicles', coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at)
      from public.vehicles v where v.business_id=p_business_id and v.active=true), '[]'::jsonb),
    'drivers', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at)
      from public.drivers d where d.business_id=p_business_id and d.active=true), '[]'::jsonb)
  )
  from public.business_registry biz
  where biz.id=p_business_id and biz.active=true
    and biz.admin_read_token_hash is not null
    and length(coalesce(p_admin_token,'')) >= 48
    and encode(extensions.digest(p_admin_token::text,'sha256'::text),'hex')=biz.admin_read_token_hash;
$$;

revoke all on function public.upsert_pilot_customer_account(uuid,text,text) from public;
revoke all on function public.claim_public_booking_request(text,uuid,text) from public;
revoke all on function public.list_store_fleet(uuid,text) from public;
grant execute on function public.upsert_pilot_customer_account(uuid,text,text) to anon, authenticated, service_role;
grant execute on function public.claim_public_booking_request(text,uuid,text) to anon, authenticated, service_role;
grant execute on function public.list_store_fleet(uuid,text) to anon, authenticated, service_role;
