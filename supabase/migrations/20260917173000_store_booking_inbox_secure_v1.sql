alter table public.business_registry add column if not exists admin_read_token_hash text;

-- First production tenant bootstrap. Only the hash is stored in the database.
update public.business_registry
set admin_read_token_hash = encode(extensions.digest('0eb92dc1145a3f4b1dfa8bc1cd6d09e3be00bebd5a4998e70b7e02f6e73732f0'::text, 'sha256'::text), 'hex')
where slug = 'pondcarrent';

create or replace function public.list_store_booking_requests(p_business_id uuid, p_admin_token text)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', br.id,
      'businessId', br.business_id,
      'businessSlug', br.business_slug,
      'bookingCode', br.booking_code,
      'token', br.secure_public_token,
      'clientRequestId', br.client_request_id,
      'serviceType', br.service_type,
      'startDate', br.start_date,
      'status', br.status,
      'payload', br.payload,
      'createdAt', br.created_at,
      'updatedAt', br.updated_at
    ) order by br.created_at desc
  ), '[]'::jsonb)
  from public.booking_requests br
  join public.business_registry biz on biz.id = br.business_id
  where br.business_id = p_business_id
    and biz.active = true
    and biz.admin_read_token_hash is not null
    and length(coalesce(p_admin_token,'')) >= 48
    and encode(extensions.digest(p_admin_token::text, 'sha256'::text), 'hex') = biz.admin_read_token_hash;
$$;

revoke all on function public.list_store_booking_requests(uuid,text) from public;
grant execute on function public.list_store_booking_requests(uuid,text) to anon, authenticated, service_role;
