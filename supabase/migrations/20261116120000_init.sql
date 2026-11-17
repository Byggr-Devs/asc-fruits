-- ASC Fruits: initial schema

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.fruits (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text not null default '🍎',
  image_path text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.varieties (
  id uuid primary key default gen_random_uuid(),
  fruit_id uuid not null references public.fruits(id) on delete restrict,
  name text not null,
  emoji text,
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (fruit_id, name)
);
create index varieties_fruit_id_idx on public.varieties(fruit_id);

-- ---------------------------------------------------------------------------
-- Vendors
-- ---------------------------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  whatsapp text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vendor_varieties (
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  variety_id uuid not null references public.varieties(id) on delete cascade,
  primary key (vendor_id, variety_id)
);
create index vendor_varieties_variety_id_idx on public.vendor_varieties(variety_id);

-- ---------------------------------------------------------------------------
-- Deliveries (godown goods receipt)
-- ---------------------------------------------------------------------------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_no bigint generated always as identity unique,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  received_at timestamptz not null default now(),
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index deliveries_vendor_id_idx on public.deliveries(vendor_id);

create table public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  variety_id uuid not null references public.varieties(id) on delete restrict,
  qty_kg numeric(12,3) not null check (qty_kg > 0)
);
create index delivery_items_delivery_id_idx on public.delivery_items(delivery_id);
create index delivery_items_variety_id_idx on public.delivery_items(variety_id);

-- ---------------------------------------------------------------------------
-- Orders (office procurement)
-- ---------------------------------------------------------------------------
create type public.order_status as enum ('pending', 'fulfilled', 'cancelled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity unique,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  status public.order_status not null default 'pending',
  notes text,
  delivery_id uuid references public.deliveries(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);
create index orders_vendor_status_idx on public.orders(vendor_id, status);
create index orders_delivery_id_idx on public.orders(delivery_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variety_id uuid not null references public.varieties(id) on delete restrict,
  qty_kg numeric(12,3) not null check (qty_kg > 0),
  rate numeric(12,2) not null default 0 check (rate >= 0),
  line_total numeric(14,2) generated always as (round(qty_kg * rate, 2)) stored,
  fulfilled_qty_kg numeric(12,3)
);
create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_variety_id_idx on public.order_items(variety_id);

-- ---------------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------------
create type public.movement_type as enum ('receipt', 'adjustment');
create type public.adjustment_reason as enum ('wastage', 'correction', 'other');

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variety_id uuid not null references public.varieties(id) on delete restrict,
  qty_kg numeric(12,3) not null check (qty_kg <> 0),
  type public.movement_type not null,
  reason public.adjustment_reason,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((type = 'adjustment') = (reason is not null))
);
create index stock_movements_variety_id_idx on public.stock_movements(variety_id);
create index stock_movements_created_at_idx on public.stock_movements(created_at);
create index stock_movements_delivery_id_idx on public.stock_movements(delivery_id);

create view public.current_stock
with (security_invoker = true) as
select
  v.id as variety_id,
  v.name as variety_name,
  v.emoji as variety_emoji,
  v.image_path as variety_image_path,
  f.id as fruit_id,
  f.name as fruit_name,
  f.emoji as fruit_emoji,
  f.image_path as fruit_image_path,
  coalesce(sum(m.qty_kg), 0)::numeric(14,3) as qty_kg,
  max(m.created_at) as last_movement_at
from public.varieties v
join public.fruits f on f.id = v.fruit_id
left join public.stock_movements m on m.variety_id = v.id
group by v.id, f.id;

-- ---------------------------------------------------------------------------
-- RLS: every authenticated user is an admin for now
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'fruits', 'varieties', 'vendors', 'vendor_varieties', 'deliveries',
    'delivery_items', 'orders', 'order_items', 'stock_movements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: does at least one user exist? (drives the setup screen)
-- ---------------------------------------------------------------------------
create or replace function public.app_has_users()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users);
$$;
revoke all on function public.app_has_users() from public;
grant execute on function public.app_has_users() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: complete a delivery in one transaction
-- payload: {
--   vendor_id, notes?, received_at?,
--   items:  [{ variety_id, qty_kg }],
--   orders: [{ order_id, items: [{ order_item_id, fulfilled_qty_kg }] }]
-- }
-- ---------------------------------------------------------------------------
create or replace function public.complete_delivery(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery_id uuid;
  v_vendor_id uuid := (payload->>'vendor_id')::uuid;
  v_order jsonb;
  v_item jsonb;
  v_order_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if v_vendor_id is null then
    raise exception 'vendor_id is required';
  end if;
  if jsonb_array_length(coalesce(payload->'items', '[]'::jsonb)) = 0 then
    raise exception 'At least one received item is required';
  end if;

  insert into public.deliveries (vendor_id, notes, received_at)
  values (
    v_vendor_id,
    nullif(payload->>'notes', ''),
    coalesce((payload->>'received_at')::timestamptz, now())
  )
  returning id into v_delivery_id;

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    if (v_item->>'qty_kg')::numeric > 0 then
      insert into public.delivery_items (delivery_id, variety_id, qty_kg)
      values (v_delivery_id, (v_item->>'variety_id')::uuid, (v_item->>'qty_kg')::numeric);

      insert into public.stock_movements (variety_id, qty_kg, type, delivery_id)
      values ((v_item->>'variety_id')::uuid, (v_item->>'qty_kg')::numeric, 'receipt', v_delivery_id);
    end if;
  end loop;

  for v_order in select * from jsonb_array_elements(coalesce(payload->'orders', '[]'::jsonb)) loop
    v_order_id := (v_order->>'order_id')::uuid;

    update public.orders
       set status = 'fulfilled', fulfilled_at = now(), delivery_id = v_delivery_id
     where id = v_order_id and vendor_id = v_vendor_id and status = 'pending';
    if not found then
      raise exception 'Order % is not a pending order for this vendor', v_order_id;
    end if;

    for v_item in select * from jsonb_array_elements(coalesce(v_order->'items', '[]'::jsonb)) loop
      update public.order_items
         set fulfilled_qty_kg = (v_item->>'fulfilled_qty_kg')::numeric
       where id = (v_item->>'order_item_id')::uuid and order_id = v_order_id;
    end loop;

    update public.order_items
       set fulfilled_qty_kg = qty_kg
     where order_id = v_order_id and fulfilled_qty_kg is null;
  end loop;

  return v_delivery_id;
end;
$$;
revoke all on function public.complete_delivery(jsonb) from public, anon;
grant execute on function public.complete_delivery(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: daily stock report (business day in Asia/Kolkata)
-- ---------------------------------------------------------------------------
create or replace function public.daily_report(day date)
returns table (
  variety_id uuid,
  variety_name text,
  fruit_name text,
  fruit_emoji text,
  opening_kg numeric,
  received_kg numeric,
  adjusted_kg numeric,
  closing_kg numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      (day::timestamp at time zone 'Asia/Kolkata') as day_start,
      ((day + 1)::timestamp at time zone 'Asia/Kolkata') as day_end
  )
  select
    v.id,
    v.name,
    f.name,
    f.emoji,
    coalesce(sum(m.qty_kg) filter (where m.created_at < b.day_start), 0),
    coalesce(sum(m.qty_kg) filter (where m.type = 'receipt' and m.created_at >= b.day_start and m.created_at < b.day_end), 0),
    coalesce(sum(m.qty_kg) filter (where m.type = 'adjustment' and m.created_at >= b.day_start and m.created_at < b.day_end), 0),
    coalesce(sum(m.qty_kg) filter (where m.created_at < b.day_end), 0)
  from public.varieties v
  join public.fruits f on f.id = v.fruit_id
  cross join bounds b
  left join public.stock_movements m on m.variety_id = v.id
  group by v.id, v.name, f.name, f.emoji, f.sort_order
  having count(m.id) > 0
  order by f.sort_order, f.name, v.name;
$$;
grant execute on function public.daily_report(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: catalog images (public read, authenticated write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do nothing;

create policy "catalog images insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'catalog-images');
create policy "catalog images update" on storage.objects
  for update to authenticated using (bucket_id = 'catalog-images');
create policy "catalog images delete" on storage.objects
  for delete to authenticated using (bucket_id = 'catalog-images');
create policy "catalog images select" on storage.objects
  for select to authenticated using (bucket_id = 'catalog-images');

-- ---------------------------------------------------------------------------
-- Starter catalog (editable in the app)
-- ---------------------------------------------------------------------------
insert into public.fruits (name, emoji, sort_order) values
  ('Apple', '🍎', 1), ('Mango', '🥭', 2), ('Banana', '🍌', 3),
  ('Orange', '🍊', 4), ('Grapes', '🍇', 5), ('Pomegranate', '🔴', 6),
  ('Watermelon', '🍉', 7), ('Pineapple', '🍍', 8);

insert into public.varieties (fruit_id, name)
select f.id, v.name
from public.fruits f
join (values
  ('Apple', 'Kashmir Apple'), ('Apple', 'Shimla Apple'), ('Apple', 'Washington Apple'),
  ('Mango', 'Alphonso'), ('Mango', 'Banganapalli'), ('Mango', 'Totapuri'),
  ('Banana', 'Robusta'), ('Banana', 'Yelakki'), ('Banana', 'Nendran'),
  ('Orange', 'Nagpur Orange'), ('Grapes', 'Thompson Seedless'), ('Grapes', 'Black Grapes'),
  ('Pomegranate', 'Bhagwa'), ('Watermelon', 'Kiran'), ('Pineapple', 'Queen')
) as v(fruit, name) on v.fruit = f.name;
