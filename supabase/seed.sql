-- Pilot seed. Marked is_seed = true. Do not treat as real POND operational facts.
-- Profiles / auth users are created separately (local-dev store or Supabase Auth).

insert into public.regions (id, name_th, name_en, sort_order) values
  ('11111111-1111-4111-8111-111111111111', 'ภาคเหนือ', 'Northern Thailand', 1)
on conflict (id) do nothing;

insert into public.provinces (id, region_id, name_th, name_en, slug) values
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'เชียงใหม่', 'Chiang Mai', 'chiang-mai'),
  ('22222222-2222-4222-8222-222222222223', '11111111-1111-4111-8111-111111111111', 'เชียงราย', 'Chiang Rai', 'chiang-rai')
on conflict (id) do nothing;

insert into public.businesses (
  id, name, slug, description, phone, email, region_id, province_id,
  address, latitude, longitude, timezone, currency, status, subscription_plan, is_seed
) values
  (
    '33333333-3333-4333-8333-333333333333',
    'POND Car Rent',
    'pondcarrent',
    'ร้านนำร่อง #001 ของ KubHai ที่เชียงใหม่ ข้อมูลนี้เป็นข้อมูลตัวอย่างสำหรับทดสอบระบบ',
    '000-000-0000',
    'demo@pondcarrent.example',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'เชียงใหม่ (ที่อยู่ตัวอย่าง)',
    18.7883, 98.9853,
    'Asia/Bangkok', 'THB', 'ACTIVE', 'pilot', true
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'Store #002 Demo',
    'demo-store-002',
    'ร้านจำลองสำหรับทดสอบ tenant isolation',
    null, null,
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    null, null, null,
    'Asia/Bangkok', 'THB', 'ACTIVE', 'pilot', true
  )
on conflict (id) do nothing;

insert into public.business_settings (business_id, faq, booking_notes, default_deposit_percent, allow_partner_vehicles)
values
  (
    '33333333-3333-4333-8333-333333333333',
    '[
      {"question":"ค่าน้ำมันรวมไหม","answer":"ขึ้นกับประเภทบริการ ร้านจะระบุในใบเสนอราคา"},
      {"question":"ค่าทางด่วนรวมไหม","answer":"ค่าทางด่วนมักแยกตามการใช้งานจริง"},
      {"question":"ยกเลิกได้ไหม","answer":"แจ้งร้านได้ เงื่อนไขมัดจำขึ้นกับสถานะการจอง"}
    ]'::jsonb,
    'คำขอจองจะถูกตรวจสอบรถและราคาก่อนยืนยัน',
    30,
    true
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '[]'::jsonb,
    null,
    30,
    true
  )
on conflict (business_id) do nothing;

insert into public.domain_mappings (business_id, host, path_slug, status, is_primary) values
  ('33333333-3333-4333-8333-333333333333', null, 'pondcarrent', 'ACTIVE', true),
  ('44444444-4444-4444-8444-444444444444', null, 'demo-store-002', 'ACTIVE', true)
on conflict (path_slug) do nothing;

insert into public.vehicles (
  id, business_id, ownership_type, vehicle_type, brand, model, color,
  plate_number, seats, luggage_capacity, description, amenities,
  base_price, pricing_unit, status, active, is_seed
) values
  (
    '55555555-5555-4555-8555-555555555551',
    '33333333-3333-4333-8333-333333333333',
    'OWN', 'VAN', 'Toyota', 'Commuter (ตัวอย่าง)', 'ขาว',
    'ตัวอย่าง — ไม่ใช่ทะเบียนจริง', 9, 6,
    'รถตู้ตัวอย่างสำหรับนำร่อง',
    '["แอร์","น้ำดื่ม","ที่ชาร์จมือถือ"]'::jsonb,
    1800, 'วัน', 'ACTIVE', true, true
  ),
  (
    '55555555-5555-4555-8555-555555555552',
    '33333333-3333-4333-8333-333333333333',
    'OWN', 'SUV', 'Toyota', 'Fortuner (ตัวอย่าง)', 'เทา',
    'ตัวอย่าง — ไม่ใช่ทะเบียนจริง', 7, 4,
    'รถ SUV ตัวอย่างสำหรับนำร่อง',
    '["แอร์","ที่ชาร์จมือถือ"]'::jsonb,
    2200, 'วัน', 'ACTIVE', true, true
  )
on conflict (id) do nothing;

insert into public.drivers (
  id, business_id, driver_type, name, nickname, phone, status, active, is_seed
) values
  (
    '66666666-6666-4666-8666-666666666661',
    '33333333-3333-4333-8333-333333333333',
    'INTERNAL', 'คนขับตัวอย่าง A', 'เอ', '000-000-0001', 'ACTIVE', true, true
  ),
  (
    '66666666-6666-4666-8666-666666666662',
    '33333333-3333-4333-8333-333333333333',
    'PARTNER', 'คนขับพาร์ทเนอร์ตัวอย่าง', null, '000-000-0002', 'ACTIVE', true, true
  )
on conflict (id) do nothing;

insert into public.places (
  id, business_id, province_id, category, name, slug, description,
  local_recommended, featured, sponsored, status, is_seed
) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'ATTRACTION', 'ดอยสุเทพ (ตัวอย่าง)', 'doi-suthep-seed', 'สถานที่ท่องเที่ยวตัวอย่าง', true, false, false, 'ACTIVE', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'ATTRACTION', 'วัดพระสิงห์ (ตัวอย่าง)', 'wat-phra-singh-seed', 'วัดตัวอย่างในเมืองเชียงใหม่', true, false, false, 'ACTIVE', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'LOCAL_FOOD', 'ร้านอาหารพื้นบ้านตัวอย่าง', 'local-food-seed', 'ร้านอาหารรสเด็ดคนพื้นที่แนะนำ — ข้อมูลตัวอย่าง', true, false, false, 'ACTIVE', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'RESTAURANT', 'ร้านอาหารดังตัวอย่าง', 'famous-restaurant-seed', 'ร้านอาหารดังสำหรับทดสอบหมวดหมู่', false, false, false, 'ACTIVE', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'CAFE', 'คาเฟ่ตัวอย่างนิมมาน', 'cafe-nimman-seed', 'คาเฟ่ตัวอย่าง ไม่ใช่ร้านจริง', true, false, false, 'ACTIVE', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'HOTEL', 'ที่พักตัวอย่าง', 'hotel-seed', 'ที่พักตัวอย่างสำหรับจัดทริป', false, false, false, 'ACTIVE', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'ACTIVITY', 'กิจกรรมตัวอย่าง', 'activity-seed', 'กิจกรรมท่องเที่ยวตัวอย่าง', true, false, false, 'ACTIVE', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'SOUVENIR', 'ของฝากตัวอย่าง', 'souvenir-seed', 'จุดซื้อของฝากตัวอย่าง', true, false, false, 'ACTIVE', true)
on conflict (id) do nothing;
