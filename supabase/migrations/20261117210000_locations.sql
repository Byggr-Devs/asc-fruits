-- Multi-location stock: locations master, allocations on receipt, transfers

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  name_ta text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.locations (id, slug, name, name_ta, sort_order) values
  ('a0000000-0000-4000-8000-000000000001', 'godown', 'Godown', 'கிடங்கு', 1),
  ('a0000000-0000-4000-8000-000000000002', 'shop-1', 'Shop 1', 'கடை 1', 2),
  ('a0000000-0000-4000-8000-000000000003', 'shop-2', 'Shop 2', 'கடை 2', 3);

-- ---------------------------------------------------------------------------
-- Stock movements: location + transfer support
-- (enum value 'transfer' added in 20261117205000_movement_type_transfer.sql)
-- ---------------------------------------------------------------------------
alter table public.stock_movements
  add column if not exists location_id uuid references public.locations(id) on delete restrict,
  add column if not exists transfer_group_id uuid;

update public.stock_movements
   set location_id = 'a0000000-0000-4000-8000-000000000001'
 where location_id is null;

alter table public.stock_movements
  alter column location_id set not null;

create index if not exists stock_movements_location_id_idx on public.stock_movements(location_id);
create index if not exists stock_movements_transfer_group_id_idx on public.stock_movements(transfer_group_id);

-- ---------------------------------------------------------------------------
-- Delivery item allocations (split received qty across locations)
-- ---------------------------------------------------------------------------
create table public.delivery_item_allocations (
  id uuid primary key default gen_random_uuid(),
  delivery_item_id uuid not null references public.delivery_items(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  qty_kg numeric(12,3) not null check (qty_kg > 0),
  unique (delivery_item_id, location_id)
);
create index delivery_item_allocations_delivery_item_id_idx
  on public.delivery_item_allocations(delivery_item_id);
create index delivery_item_allocations_location_id_idx
  on public.delivery_item_allocations(location_id);

-- Backfill: existing delivery items → full qty at Godown
insert into public.delivery_item_allocations (delivery_item_id, location_id, qty_kg)
select di.id, 'a0000000-0000-4000-8000-000000000001', di.qty_kg
from public.delivery_items di
where not exists (
  select 1 from public.delivery_item_allocations a where a.delivery_item_id = di.id
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.locations enable row level security;
create policy "authenticated full access" on public.locations
  for all to authenticated using (true) with check (true);

alter table public.delivery_item_allocations enable row level security;
create policy "authenticated full access" on public.delivery_item_allocations
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- current_stock by variety + location
-- ---------------------------------------------------------------------------
drop view if exists public.current_stock;
create view public.current_stock
with (security_invoker = true) as
select
  v.id as variety_id,
  v.name as variety_name,
  v.name_ta as variety_name_ta,
  v.emoji as variety_emoji,
  v.image_path as variety_image_path,
  f.id as fruit_id,
  f.name as fruit_name,
  f.name_ta as fruit_name_ta,
  f.emoji as fruit_emoji,
  f.image_path as fruit_image_path,
  l.id as location_id,
  l.name as location_name,
  l.name_ta as location_name_ta,
  l.slug as location_slug,
  l.sort_order as location_sort_order,
  coalesce(sum(m.qty_kg), 0)::numeric(14,3) as qty_kg,
  max(m.created_at) as last_movement_at
from public.varieties v
join public.fruits f on f.id = v.fruit_id
cross join public.locations l
left join public.stock_movements m
  on m.variety_id = v.id and m.location_id = l.id
group by v.id, f.id, l.id;

-- ---------------------------------------------------------------------------
-- complete_delivery: items may include allocations[{location_id, qty_kg}]
-- If allocations omitted, full qty goes to Godown.
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
  v_alloc jsonb;
  v_order_id uuid;
  v_item_id uuid;
  v_variety_id uuid;
  v_qty numeric;
  v_alloc_sum numeric;
  v_godown uuid := 'a0000000-0000-4000-8000-000000000001';
  v_loc uuid;
  v_alloc_qty numeric;
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
    v_variety_id := (v_item->>'variety_id')::uuid;
    v_qty := (v_item->>'qty_kg')::numeric;
    if v_qty is null or v_qty <= 0 then
      continue;
    end if;

    insert into public.delivery_items (delivery_id, variety_id, qty_kg)
    values (v_delivery_id, v_variety_id, v_qty)
    returning id into v_item_id;

    if jsonb_typeof(v_item->'allocations') = 'array'
       and jsonb_array_length(v_item->'allocations') > 0 then
      v_alloc_sum := 0;
      for v_alloc in select * from jsonb_array_elements(v_item->'allocations') loop
        v_alloc_qty := (v_alloc->>'qty_kg')::numeric;
        v_loc := (v_alloc->>'location_id')::uuid;
        if v_alloc_qty is null or v_alloc_qty <= 0 or v_loc is null then
          raise exception 'Invalid allocation for variety %', v_variety_id;
        end if;
        v_alloc_sum := v_alloc_sum + v_alloc_qty;

        insert into public.delivery_item_allocations (delivery_item_id, location_id, qty_kg)
        values (v_item_id, v_loc, v_alloc_qty);

        insert into public.stock_movements (variety_id, qty_kg, type, delivery_id, location_id)
        values (v_variety_id, v_alloc_qty, 'receipt', v_delivery_id, v_loc);
      end loop;

      if round(v_alloc_sum, 3) <> round(v_qty, 3) then
        raise exception 'Allocations for variety % must sum to % kg (got %)',
          v_variety_id, v_qty, v_alloc_sum;
      end if;
    else
      insert into public.delivery_item_allocations (delivery_item_id, location_id, qty_kg)
      values (v_item_id, v_godown, v_qty);

      insert into public.stock_movements (variety_id, qty_kg, type, delivery_id, location_id)
      values (v_variety_id, v_qty, 'receipt', v_delivery_id, v_godown);
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
-- Transfer stock between locations (paired ledger rows)
-- ---------------------------------------------------------------------------
create or replace function public.transfer_stock(
  p_variety_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_qty_kg numeric,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group uuid := gen_random_uuid();
  v_available numeric;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_variety_id is null or p_from_location_id is null or p_to_location_id is null then
    raise exception 'variety and both locations are required';
  end if;
  if p_from_location_id = p_to_location_id then
    raise exception 'Source and destination must differ';
  end if;
  if p_qty_kg is null or p_qty_kg <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  select coalesce(sum(qty_kg), 0) into v_available
  from public.stock_movements
  where variety_id = p_variety_id and location_id = p_from_location_id;

  if v_available < p_qty_kg then
    raise exception 'Insufficient stock at source (available %, requested %)', v_available, p_qty_kg;
  end if;

  insert into public.stock_movements
    (variety_id, qty_kg, type, location_id, transfer_group_id, note)
  values
    (p_variety_id, -p_qty_kg, 'transfer', p_from_location_id, v_group, nullif(p_note, '')),
    (p_variety_id,  p_qty_kg, 'transfer', p_to_location_id,   v_group, nullif(p_note, ''));

  return v_group;
end;
$$;
revoke all on function public.transfer_stock(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.transfer_stock(uuid, uuid, uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- daily_report: optional location filter (null = all locations aggregated)
-- ---------------------------------------------------------------------------
drop function if exists public.daily_report(date);
drop function if exists public.daily_report(date, uuid);
create function public.daily_report(day date, p_location_id uuid default null)
returns table (
  variety_id uuid,
  variety_name text,
  variety_name_ta text,
  fruit_name text,
  fruit_name_ta text,
  fruit_emoji text,
  location_id uuid,
  location_name text,
  location_name_ta text,
  opening_kg numeric,
  received_kg numeric,
  adjusted_kg numeric,
  transferred_kg numeric,
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
    v.name_ta,
    f.name,
    f.name_ta,
    f.emoji,
    l.id,
    l.name,
    l.name_ta,
    coalesce(sum(m.qty_kg) filter (where m.created_at < b.day_start), 0),
    coalesce(sum(m.qty_kg) filter (where m.type = 'receipt' and m.created_at >= b.day_start and m.created_at < b.day_end), 0),
    coalesce(sum(m.qty_kg) filter (where m.type = 'adjustment' and m.created_at >= b.day_start and m.created_at < b.day_end), 0),
    coalesce(sum(m.qty_kg) filter (where m.type = 'transfer' and m.created_at >= b.day_start and m.created_at < b.day_end), 0),
    coalesce(sum(m.qty_kg) filter (where m.created_at < b.day_end), 0)
  from public.varieties v
  join public.fruits f on f.id = v.fruit_id
  join public.locations l on (p_location_id is null or l.id = p_location_id)
  cross join bounds b
  left join public.stock_movements m
    on m.variety_id = v.id and m.location_id = l.id
  group by v.id, v.name, v.name_ta, f.name, f.name_ta, f.emoji, f.sort_order, l.id, l.name, l.name_ta, l.sort_order
  having count(m.id) > 0
  order by l.sort_order, f.sort_order, f.name, v.name;
$$;
grant execute on function public.daily_report(date, uuid) to authenticated;
